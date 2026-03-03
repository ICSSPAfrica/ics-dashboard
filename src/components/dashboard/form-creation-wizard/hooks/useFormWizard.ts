import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { toast } from '@/hooks/use-toast';
import { 
  saveFormWizardDraft, 
  loadFormWizardDraft, 
  hasFormWizardDraft, 
  clearFormWizardDraft, 
  autoSaveFormWizardDraft, 
  clearFormWizardAutoSaveTimeout
} from '@/lib/formLocalStorageUtils';
import { useForm } from '@/contexts/FormContext';
import { 
  Form, 
  FormSection, 
  FormQuestion, 
  FormWizardState, 
  FormSettings,
  ActivityKPIMapping,
  QuestionType 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

// Wizard steps
export interface WizardStep {
  id: string;
  title: string;
  description: string;
}

export function useFormWizard(formId?: string) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentProject } = useDashboard();
  const { getProjectOutcomes, getProjectActivities, getProjectKPIs } = useProjects();
  const { createForm, updateForm, loadForm } = useForm();
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [wizardState, setWizardState] = useState<FormWizardState>({
    currentStep: 0,
    form: {
      id: formId || uuidv4(),
      title: '',
      description: '',
      projectId: '',
      createdBy: user?.id || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'DRAFT',
      version: 1,
      sections: [],
      settings: {
        requireAuthentication: false,
        allowedRoles: ['global-admin', 'country-admin', 'project-admin', 'branch-admin', 'viewer'],
        thankYouMessage: 'Thank you for your response!',
        notificationEmails: [],
      },
      responseCount: 0,
      tags: [],
    },
    availableProjects: [],
    availableActivities: [],
    isEditing: !!formId,
    hasUnsavedChanges: false,
  });

  const [isPublishing, setIsPublishing] = useState(false);

  const steps: WizardStep[] = [
    { id: 'basic-info', title: 'Basic Information', description: 'Form title, description, and project' },
    { id: 'sections', title: 'Form Structure', description: 'Organize your form into sections' },
    { id: 'questions', title: 'Add Questions', description: 'Create and configure form questions' },
    { id: 'activity-links', title: 'Activity Links', description: 'Link questions to project activities' },
    { id: 'settings', title: 'Form Settings', description: 'Configure form behavior and permissions' },
    { id: 'review', title: 'Review & Deploy', description: 'Review your form and deploy it' },
  ];

  // Load available projects and activities
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        console.log('🔄 FormWizard: loadProjectData called with currentProject:', currentProject);
        
        if (!currentProject) {
          console.log('🔄 FormWizard: No currentProject yet, waiting...');
          return;
        }

        console.log('🔄 FormWizard: Loading project data for:', currentProject.id, currentProject.name);
        const availableProjects = [{ id: currentProject.id, name: currentProject.name }];
        
        // Load activities for the current project using ProjectsContext API
        const allActivities: ActivityKPIMapping[] = [];
        
        try {
          console.log('🔄 FormWizard: Fetching outcomes and activities via ProjectsContext...');
          const [outcomes, activities] = await Promise.all([
            getProjectOutcomes(currentProject.id),
            getProjectActivities(currentProject.id)
          ]);
          
          console.log(`🔄 FormWizard: Loaded ${outcomes.length} outcomes and ${activities.length} activities`);

          // Map activities to outcomes and create activity mappings
          outcomes.forEach(outcome => {
            const outcomeActivities = activities.filter(activity => activity.outcomeId === outcome.id);
            outcomeActivities.forEach(activity => {
              allActivities.push({
                projectId: currentProject.id,
                outcomeId: outcome.id,
                activityId: activity.id,
                activityName: activity.title,
                outcomeName: outcome.title,
                projectName: currentProject.name,
                availableKPIs: [], // Will be loaded from KPI data
              });
            });
          });

          console.log(`🔄 FormWizard: Created ${allActivities.length} activity mappings`);
        } catch (dataError) {
          console.error('🔄 FormWizard: Error fetching project data:', dataError);
          // Continue with empty activities if data fetch fails
        }

        console.log('🔄 FormWizard: Setting wizard state with availableProjects:', availableProjects);
        setWizardState(prev => ({
          ...prev,
          availableProjects,
          availableActivities: allActivities,
          // Always ensure the current project is set
          form: {
            ...prev.form,
            projectId: currentProject.id,
          },
        }));
        
        setIsInitialized(true);
        console.log('✅ FormWizard: Project data loaded successfully');
      } catch (error) {
        console.error('❌ FormWizard: Error loading project data:', error);
        toast({
          title: "Error Loading Data",
          description: "Failed to load project and activity data.",
          variant: "destructive",
        });
      }
    };

    loadProjectData();
  }, [currentProject, getProjectOutcomes, getProjectActivities]);

  // Handle redirect after initialization if no project
  useEffect(() => {
    if (isInitialized && !currentProject) {
      toast({
        title: "No Project Selected",
        description: "Please select a project before creating a form.",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  }, [isInitialized, currentProject, navigate]);

  // Load draft for new form creation or existing form for editing
  useEffect(() => {
    if (!wizardState.isEditing) {
      // Load draft for new form creation
      const draft = loadFormWizardDraft();
      if (draft) {
        // Ensure we preserve the current project context even when loading a draft
        setWizardState(prev => ({
          ...draft,
          availableProjects: prev.availableProjects, // Keep current project context
          availableActivities: prev.availableActivities, // Keep current project activities
          form: {
            ...draft.form,
            projectId: currentProject?.id || draft.form.projectId, // Ensure current project is set
          },
        }));
      }
    } else if (formId && currentProject?.id) {
      // Load existing form for editing via API
      loadForm(currentProject.id, formId).then(existingForm => {
        if (existingForm) {
          // Preserve section and question order (API may return in different order)
          const sections = (existingForm.sections || [])
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map(s => ({
              ...s,
              questions: (s.questions || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
            }));
          const formWithOrder = { ...existingForm, sections };
          setWizardState(prev => ({
            ...prev,
            form: formWithOrder,
            hasUnsavedChanges: false,
          }));
        } else {
          toast({
            title: "Form Not Found",
            description: "The form you're trying to edit could not be found.",
            variant: "destructive",
          });
          navigate('/dashboard');
        }
      });
    }
  }, [wizardState.isEditing, formId, navigate, currentProject]);

  // Auto-save draft when wizard state changes (only for new forms)
  useEffect(() => {
    if (!wizardState.isEditing && wizardState.form.title) {
      autoSaveFormWizardDraft(wizardState);
    }
    
    // Cleanup auto-save timeout on unmount
    return () => {
      clearFormWizardAutoSaveTimeout();
    };
  }, [wizardState, wizardState.isEditing]);

  // Basic form information handlers
  const updateBasicInfo = useCallback((field: string, value: any) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        [field]: value,
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  // Section management
  const addSection = useCallback(() => {
    const newSection: FormSection = {
      id: uuidv4(),
      title: `Section ${(wizardState.form.sections?.length || 0) + 1}`,
      description: '',
      order: (wizardState.form.sections?.length || 0) + 1,
      questions: [],
    };

    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: [...(prev.form.sections || []), newSection],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, [wizardState.form.sections]);

  const updateSection = useCallback((sectionId: string, updates: Partial<FormSection>) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.map(section =>
          section.id === sectionId ? { ...section, ...updates } : section
        ) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.filter(section => section.id !== sectionId) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  const reorderSections = useCallback((startIndex: number, endIndex: number) => {
    setWizardState(prev => {
      const sections = [...(prev.form.sections || [])];
      const [removed] = sections.splice(startIndex, 1);
      sections.splice(endIndex, 0, removed);
      
      // Update order values
      const reorderedSections = sections.map((section, index) => ({
        ...section,
        order: index + 1,
      }));

      return {
        ...prev,
        form: {
          ...prev.form,
          sections: reorderedSections,
          updatedAt: new Date(),
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  // Question management
  const addQuestion = useCallback((sectionId: string, questionType: QuestionType, afterQuestionId?: string) => {
    const section = wizardState.form.sections?.find(s => s.id === sectionId);
    if (!section) return;

    const baseQuestion = {
      id: uuidv4(),
      type: questionType,
      title: '',
      description: '',
      isRequired: false,
      validationRules: [],
      order: section.questions.length + 1,
      dataType: getDefaultDataType(questionType),
    };

    // Create question with type-specific properties
    const newQuestion = createQuestionWithDefaults(baseQuestion, questionType);

    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.map(s => {
          if (s.id !== sectionId) return s;
          const questions = [...s.questions];

          if (afterQuestionId) {
            const idx = questions.findIndex(q => q.id === afterQuestionId);
            const insertIndex = idx !== -1 ? idx + 1 : questions.length;
            questions.splice(insertIndex, 0, newQuestion);
          } else {
            questions.push(newQuestion);
          }

          // Recompute order
          const reOrdered = questions.map((q, index) => ({ ...q, order: index + 1 }));

          return { ...s, questions: reOrdered };
        }) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, [wizardState.form.sections]);

  const updateQuestion = useCallback((sectionId: string, questionId: string, updates: Partial<FormQuestion>) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.map(section =>
          section.id === sectionId
            ? {
                ...section,
                questions: section.questions.map(question =>
                  question.id === questionId ? { ...question, ...updates } as FormQuestion : question
                ),
              }
            : section
        ) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  const removeQuestion = useCallback((sectionId: string, questionId: string) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.map(section =>
          section.id === sectionId
            ? {
                ...section,
                questions: section.questions.filter(q => q.id !== questionId),
              }
            : section
        ) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  const duplicateQuestion = useCallback((sectionId: string, questionId: string) => {
    const section = wizardState.form.sections?.find(s => s.id === sectionId);
    const question = section?.questions.find(q => q.id === questionId);
    
    if (!question || !section) return;

    const duplicatedQuestion = {
      ...question,
      id: uuidv4(),
      title: `${question.title} (Copy)`,
      order: section.questions.length + 1,
    };

    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        sections: prev.form.sections?.map(s =>
          s.id === sectionId 
            ? { ...s, questions: [...s.questions, duplicatedQuestion] }
            : s
        ) || [],
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, [wizardState.form.sections]);

  const reorderQuestions = useCallback((sectionId: string, startIndex: number, endIndex: number) => {
    setWizardState(prev => {
      const sections = [...(prev.form.sections || [])];
      const sectionIndex = sections.findIndex(s => s.id === sectionId);
      
      if (sectionIndex === -1) return prev;
      
      const section = sections[sectionIndex];
      const questions = [...section.questions];
      const [removed] = questions.splice(startIndex, 1);
      questions.splice(endIndex, 0, removed);
      
      // Update order values
      const reorderedQuestions = questions.map((question, index) => ({
        ...question,
        order: index + 1,
      }));

      sections[sectionIndex] = {
        ...section,
        questions: reorderedQuestions,
      };

      return {
        ...prev,
        form: {
          ...prev.form,
          sections,
          updatedAt: new Date(),
        },
        hasUnsavedChanges: true,
      };
    });
  }, []);

  // Activity linking
  const linkQuestionToActivity = useCallback((
    sectionId: string, 
    questionId: string, 
    activityMapping: ActivityKPIMapping
  ) => {
    updateQuestion(sectionId, questionId, {
      linkedActivity: {
        projectId: activityMapping.projectId,
        outcomeId: activityMapping.outcomeId,
        activityId: activityMapping.activityId,
      },
    });
  }, [updateQuestion]);

  // Multiple activity linking
  const linkQuestionToActivities = useCallback((
    sectionId: string, 
    questionId: string, 
    activityMappings: ActivityKPIMapping[]
  ) => {
    const linkedActivities = activityMappings.map(activityMapping => ({
      projectId: activityMapping.projectId,
      outcomeId: activityMapping.outcomeId,
      activityId: activityMapping.activityId,
      kpiContribution: activityMapping.availableKPIs && activityMapping.availableKPIs.length > 0 ? {
        kpiId: activityMapping.availableKPIs[0].id,
        weight: 1,
        aggregationType: 'SUM' as const
      } : undefined
    }));

    updateQuestion(sectionId, questionId, {
      linkedActivities,
      // Clear legacy single activity if it exists
      linkedActivity: undefined,
    });
  }, [updateQuestion]);

  // Settings management
  const updateSettings = useCallback((settings: Partial<FormSettings>) => {
    setWizardState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        settings: {
          ...prev.form.settings!,
          ...settings,
        },
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    }));
  }, []);

  // Navigation
  const nextStep = useCallback(() => {
    if (wizardState.currentStep < steps.length - 1) {
      setWizardState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
      }));
    }
  }, [wizardState.currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (wizardState.currentStep > 0) {
      setWizardState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
      }));
    }
  }, [wizardState.currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setWizardState(prev => ({
        ...prev,
        currentStep: stepIndex,
      }));
    }
  }, [steps.length]);

  // Validation
  const validateCurrentStep = useCallback(() => {
    const currentStepId = steps[wizardState.currentStep].id;
    
    switch (currentStepId) {
      case 'basic-info':
        return !!(wizardState.form.title && wizardState.form.projectId);
      case 'sections':
        return (wizardState.form.sections?.length || 0) > 0;
      case 'questions':
        return wizardState.form.sections?.some(section => section.questions.length > 0) || false;
      default:
        return true;
    }
  }, [wizardState.currentStep, wizardState.form, steps]);

  // Save and deploy
  const saveDraft = useCallback(async () => {
    try {
      // Create the draft form with updated timestamp
      const draftForm = {
        ...wizardState.form,
        status: 'DRAFT' as const,
        updatedAt: new Date(),
      };

      console.log('Saving draft form:', { 
        formId: wizardState.form.id, 
        isEditing: wizardState.isEditing, 
        title: wizardState.form.title 
      });

      if (!currentProject?.id) {
        throw new Error('No project selected');
      }
      
      if (wizardState.isEditing && wizardState.form.id) {
        // Update existing form via API
        console.log('Updating existing form via API');
        const updatedForm = await updateForm(currentProject.id, wizardState.form.id, draftForm);
        if (updatedForm) {
          setWizardState(prev => ({ ...prev, form: updatedForm }));
        }
      } else {
        // Create new form via API
        console.log('Creating new form via API');
        const newForm = await createForm(currentProject.id, {
          title: draftForm.title || '',
          description: draftForm.description || '',
          projectId: currentProject.id,
          sections: draftForm.sections || [],
          settings: draftForm.settings
        });
        if (newForm) {
          setWizardState(prev => ({ ...prev, form: newForm, isEditing: true }));
        }
      }
      
      // Clear localStorage draft after successful save
      if (!wizardState.isEditing) {
        clearFormWizardDraft();
      }
      
      // Update local state
      setWizardState(prev => ({
        ...prev,
        form: draftForm,
        hasUnsavedChanges: false,
      }));

      toast({
        title: "Draft Saved",
        description: "Your form has been saved as a draft.",
      });

      // Navigate to form management after successful save
      setTimeout(() => {
        if (wizardState.form.projectId) {
          navigate(`/dashboard/projects/${wizardState.form.projectId}/forms/`);
        } else {
          navigate('/dashboard');
        }
      }, 1500);

      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the form draft.",
        variant: "destructive",
      });
      return false;
    }
  }, [wizardState.form, wizardState.isEditing]);

  const publishForm = useCallback(async () => {
    try {
      setIsPublishing(true);
      
      // Validate form before publishing
      if (!validateForm()) {
        setIsPublishing(false);
        return false;
      }

      // Create the published form with updated status and timestamp
      const publishedForm = {
        ...wizardState.form,
        status: 'PUBLISHED' as const,
        updatedAt: new Date(),
      };

      console.log('Publishing form:', { 
        formId: wizardState.form.id, 
        isEditing: wizardState.isEditing, 
        title: wizardState.form.title 
      });

      if (!currentProject?.id) {
        throw new Error('No project selected');
      }
      
      if (wizardState.isEditing && wizardState.form.id) {
        // Update existing form via API - only send updatable fields
        console.log('Publishing existing form via API');
        const updateData = {
          title: publishedForm.title,
          description: publishedForm.description,
          status: publishedForm.status,
          tags: publishedForm.tags,
          category: publishedForm.category,
          sections: publishedForm.sections,
          settings: publishedForm.settings
        };
        console.log('Update data being sent:', updateData);
        const updatedForm = await updateForm(currentProject.id, wizardState.form.id, updateData);
        if (updatedForm) {
          setWizardState(prev => ({ ...prev, form: updatedForm }));
        }
      } else {
        // Create new form via API
        console.log('Creating and publishing new form via API');
        const newForm = await createForm(currentProject.id, {
          title: publishedForm.title || '',
          description: publishedForm.description || '',
          projectId: currentProject.id,
          sections: publishedForm.sections || [],
          settings: publishedForm.settings
        });
        if (newForm) {
          // Update to published status
          const publishedNewForm = await updateForm(currentProject.id, newForm.id, { status: 'PUBLISHED' });
          if (publishedNewForm) {
            setWizardState(prev => ({ ...prev, form: publishedNewForm, isEditing: true }));
          }
        }
      }

      // Clear localStorage draft after successful publish
      if (!wizardState.isEditing) {
        clearFormWizardDraft();
      }

      // Update local state
      setWizardState(prev => ({
        ...prev,
        form: publishedForm,
        hasUnsavedChanges: false,
      }));

      toast({
        title: "Form Published",
        description: `${wizardState.form.title} has been published successfully.`,
      });

      // Navigate to form management after successful publish
      setTimeout(() => {
        if (wizardState.form.projectId) {
          navigate(`/dashboard/projects/${wizardState.form.projectId}/forms/`);
        } else {
          navigate('/dashboard');
        }
      }, 1500);

      return true;
    } catch (error) {
      console.error('Error publishing form:', error);
      toast({
        title: "Publishing Failed",
        description: "Failed to publish the form.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsPublishing(false);
    }
  }, [wizardState.form, wizardState.isEditing]);

  const validateForm = useCallback(() => {
    const form = wizardState.form;
    
    if (!form.title) {
      toast({
        title: "Validation Error",
        description: "Form title is required.",
        variant: "destructive",
      });
      return false;
    }

    if (!form.projectId) {
      toast({
        title: "Validation Error",
        description: "Please select a project for this form.",
        variant: "destructive",
      });
      return false;
    }

    if (!form.sections || form.sections.length === 0) {
      toast({
        title: "Validation Error",
        description: "Form must have at least one section.",
        variant: "destructive",
      });
      return false;
    }

    const hasQuestions = form.sections.some(section => section.questions.length > 0);
    if (!hasQuestions) {
      toast({
        title: "Validation Error",
        description: "Form must have at least one question.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [wizardState.form]);

  return {
    wizardState,
    steps,
    
    // Navigation
    nextStep,
    prevStep,
    goToStep,
    validateCurrentStep,
    
    // Basic info
    updateBasicInfo,
    
    // Sections
    addSection,
    updateSection,
    removeSection,
    reorderSections,
    
    // Questions
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    reorderQuestions,
    
    // Activity linking
    linkQuestionToActivity,
    linkQuestionToActivities,
    
    // Settings
    updateSettings,
    
    // Save and deploy
    saveDraft,
    publishForm,
    validateForm,
    isPublishing,
    
    // localStorage functions
    hasDraft: hasFormWizardDraft,
    clearDraft: clearFormWizardDraft,
    
    // Navigation helpers
    navigate,
  };
}

// Helper functions
function getDefaultDataType(questionType: QuestionType) {
  switch (questionType) {
    case 'SHORT_TEXT':
    case 'EMAIL':
    case 'PHONE':
      return 'TEXT';
    case 'NUMBER':
      return 'INTEGER';
    case 'DATE':
      return 'DATE';
    case 'DATETIME':
      return 'TIMESTAMP';
    case 'YES_NO':
    case 'SINGLE_CHOICE':
      return 'TEXT';
    case 'MULTIPLE_CHOICE':
      return 'ARRAY_TEXT';
    case 'SLIDER':
      return 'INTEGER';
    case 'LIKERT_SCALE':
      return 'JSON';
    case 'IMAGE_UPLOAD':
    case 'VIDEO_UPLOAD':
    case 'AUDIO_UPLOAD':
    case 'FILE_UPLOAD':
      return 'JSON'; // Store file metadata as JSON
    default:
      return 'TEXT';
  }
}

function createQuestionWithDefaults(baseQuestion: any, questionType: QuestionType): FormQuestion {
  switch (questionType) {
    case 'SHORT_TEXT':
      return {
        ...baseQuestion,
        placeholder: 'Enter your response...',
      };
    

    case 'NUMBER':
      return {
        ...baseQuestion,
        placeholder: 'Enter a number',
        step: 1,
      };
    
    case 'SINGLE_CHOICE':
      return {
        ...baseQuestion,
        options: [
          { id: uuidv4(), label: 'Option 1', value: 'option1', hasConditionalQuestions: false, conditionalQuestions: [] },
          { id: uuidv4(), label: 'Option 2', value: 'option2', hasConditionalQuestions: false, conditionalQuestions: [] },
        ],
        displayType: 'RADIO',
      };
    
    case 'MULTIPLE_CHOICE':
      return {
        ...baseQuestion,
        options: [
          { id: uuidv4(), label: 'Option 1', value: 'option1', hasConditionalQuestions: false, conditionalQuestions: [] },
          { id: uuidv4(), label: 'Option 2', value: 'option2', hasConditionalQuestions: false, conditionalQuestions: [] },
        ],
      };
    

    

    case 'LIKERT_SCALE':
      return {
        ...baseQuestion,
        statements: [
          {
            id: uuidv4(),
            text: 'Statement 1',
            scaleType: '5_POINT'
          }
        ],
        defaultScaleType: '5_POINT',
        defaultLabels: {
          negative: 'Strongly Disagree',
          neutral: 'Neutral',
          positive: 'Strongly Agree',
        },
      };
    
    case 'YES_NO':
      return {
        ...baseQuestion,
        type: 'SINGLE_CHOICE',
        options: [
          { id: uuidv4(), label: 'Yes', value: 'yes', hasConditionalQuestions: false, conditionalQuestions: [] },
          { id: uuidv4(), label: 'No', value: 'no', hasConditionalQuestions: false, conditionalQuestions: [] },
        ],
        displayType: 'RADIO',
      };
    
    case 'DATE':
    case 'DATETIME':
      return {
        ...baseQuestion,
      };
    

    case 'SLIDER':
      return {
        ...baseQuestion,
        min: 0,
        max: 100,
        step: 1,
        showValue: true,
      };

    case 'LOCATION':
      return {
        ...baseQuestion,
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        allowManualInput: true,
        captureAddress: false,
        showMap: false,
      };

    case 'IMAGE_UPLOAD':
      return {
        ...baseQuestion,
        maxFiles: 10,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        allowMultiple: true,
        previewSize: 'medium',
        compressionQuality: 80,
      };

    case 'VIDEO_UPLOAD':
      return {
        ...baseQuestion,
        maxFiles: 4,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedFormats: ['mp4', 'avi', 'mov', 'wmv', 'webm'],
        allowMultiple: true,
        quality: 'medium',
        autoCompress: true,
      };

    case 'AUDIO_UPLOAD':
      return {
        ...baseQuestion,
        maxFiles: 3,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['mp3', 'wav', 'aac', 'ogg', 'm4a'],
        allowMultiple: true,
        quality: 'medium',
        autoCompress: true,
      };

    case 'FILE_UPLOAD':
      return {
        ...baseQuestion,
        maxFiles: 5,
        maxFileSize: 25 * 1024 * 1024, // 25MB
        allowedFormats: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
        allowMultiple: true,
        showPreview: true,
      };
    
    default:
      return baseQuestion;
  }
}
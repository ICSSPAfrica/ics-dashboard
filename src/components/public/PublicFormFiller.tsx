import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Save,
  Send,
  Eye,
  EyeOff,
  Plus
} from 'lucide-react';
import { Form, FormQuestion } from '@/components/dashboard/form-creation-wizard/types';
import { QuestionRenderer } from '@/components/dashboard/form-preview/QuestionRenderer';
import { filterMainQuestions, isConditionalQuestion } from '@/components/dashboard/form-preview/utils/questionUtils';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { toast } from '@/hooks/use-toast';
import {
  saveFormPreviewData,
  loadFormPreviewData,
  clearFormPreviewData,
  FormPreviewData
} from '@/lib/formLocalStorageUtils';
import { useForm } from '@/contexts/FormContext';
import { formsApi } from '@/lib/api/formsApi';

interface PublicFormFillerProps {
  isEmbedded?: boolean;
}

export function PublicFormFiller({ isEmbedded = false }: PublicFormFillerProps) {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { addFormResponseToStorage, validateConditionalQuestions, isOnline, syncStatus, processOfflineQueue } = useForm();
  
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [conditionalResponses, setConditionalResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  // Track number of instances per section to support repeatable sections without schema changes
  const [sectionInstanceCounts, setSectionInstanceCounts] = useState<Record<string, number>>({});
  // Version checking state
  const [currentFormVersion, setCurrentFormVersion] = useState<number>(1);
  const [latestFormVersion, setLatestFormVersion] = useState<number>(1);
  const [showVersionUpdatePrompt, setShowVersionUpdatePrompt] = useState(false);

  // Helpers for repeatable sections
  const getSectionInstanceCount = (sectionId: string) => {
    // For backwards compatibility: only use instance counts for repeatable sections
    const section = form?.sections?.find(s => s.id === sectionId);
    const isRepeatable = (section as any)?.conditional?.repeatable === true;
    return isRepeatable ? (sectionInstanceCounts[sectionId] ?? 1) : 1;
  };
  const updateSectionInstanceCount = (sectionId: string, next: number) => {
    setSectionInstanceCounts(prev => ({ ...prev, [sectionId]: Math.max(1, next) }));
  };
  const getInstanceScopedQuestionId = (baseQuestionId: string, instanceIndex: number) => {
    // For backwards compatibility: only add instance suffix for repeatable sections
    const question = form?.sections?.flatMap(s => s.questions || [])?.find(q => q.id === baseQuestionId);
    const section = form?.sections?.find(s => s.questions?.some(q => q.id === baseQuestionId));
    const isRepeatable = (section as any)?.conditional?.repeatable === true;
    return isRepeatable ? `${baseQuestionId}__i${instanceIndex}` : baseQuestionId;
  };

  // Check for form version updates
  const checkForFormVersionUpdate = async () => {
    if (!formId) return;
    
    try {
      console.log('🔍 Checking for form version updates...');
      const latestForm = await formsApi.getPublicForm(formId);
      const newVersion = latestForm.version || 1;
      
      console.log('🔍 Version check result:', {
        currentVersion: currentFormVersion,
        latestVersion: newVersion,
        hasUpdate: newVersion > currentFormVersion
      });
      
      if (newVersion > currentFormVersion) {
        setLatestFormVersion(newVersion);
        setShowVersionUpdatePrompt(true);
        console.log('🔄 New form version available:', newVersion);
      }
    } catch (err) {
      console.error('Failed to check form version:', err);
    }
  };

  // Load form data
  useEffect(() => {
    const loadForm = async () => {
      if (!formId) {
        setError('Form ID is required');
        setLoading(false);
        return;
      }

      try {
        console.log('Loading public form:', formId);
        const foundForm = await formsApi.getPublicForm(formId);
        
        console.log('Public form loaded successfully:', foundForm);
        console.log('🔍 Form sections with conditional data:', foundForm.sections?.map(s => ({
          id: s.id,
          title: s.title,
          conditional: s.conditional,
          isRepeatable: (s as any).conditional?.repeatable
        })));
        setForm(foundForm);
        setCurrentFormVersion(foundForm.version || 1);
        setLatestFormVersion(foundForm.version || 1);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load public form:', err);
        const msg: string = err?.message || '';

        // If form requires authentication, try secure endpoint when token exists
        if (msg.includes('requires authentication')) {
          const token = localStorage.getItem('ics-auth-token');
          if (token) {
            try {
              console.log('Retrying with secure endpoint for authenticated user');
              const secureForm = await formsApi.getSecureForm(formId);
              console.log('🔍 Secure form sections with conditional data:', secureForm.sections?.map(s => ({
                id: s.id,
                title: s.title,
                conditional: s.conditional,
                isRepeatable: (s as any).conditional?.repeatable
              })));
              setForm(secureForm);
              setCurrentFormVersion(secureForm.version || 1);
              setLatestFormVersion(secureForm.version || 1);
              setRequiresAuth(false);
              setLoading(false);
              return;
            } catch (secureErr: any) {
              console.error('Secure form fetch failed:', secureErr);
              // Fall through to show auth required UI
            }
          }
          setRequiresAuth(true);
          setError('This form requires authentication. Please log in to continue.');
        } else if (msg.includes('expired')) {
          setError('This form has expired and is no longer accepting responses');
        } else if (msg.includes('not found') || msg.includes('not published')) {
          setError('Form not found or not available');
        } else {
          setError('Failed to load form. Please try again later.');
        }
        
        setLoading(false);
      }
    };

    loadForm();
  }, [formId]);

  // Load saved draft data
  useEffect(() => {
    if (form?.id) {
      const savedData = loadFormPreviewData(form.id);
      if (savedData) {
        setResponses(savedData.responses);
        setConditionalResponses((savedData as any).conditionalResponses || {});
        setCurrentSectionIndex(savedData.currentSection);
        setIsDraft(true);
      }
    }
  }, [form?.id]);

  // Handle section visibility changes when responses change
  useEffect(() => {
    if (!form) return;
    
    const visibleSections = getVisibleSections(form.sections, responses);
    
    // If current section is no longer visible, navigate to the next visible section
    if (currentSectionIndex >= visibleSections.length) {
      const newIndex = Math.max(0, visibleSections.length - 1);
      setCurrentSectionIndex(newIndex);
    }
  }, [responses, form, currentSectionIndex]);

  // Auto-save draft data
  useEffect(() => {
    if (form?.id && Object.keys(responses).length > 0) {
      const previewData: Omit<FormPreviewData, 'formId'> = {
        responses,
        currentSection: currentSectionIndex,
        isComplete: false,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      saveFormPreviewData(form.id, previewData);
    }
  }, [form?.id, responses, currentSectionIndex]);

  // Periodic version checking (every 30 seconds)
  useEffect(() => {
    if (!form?.id) return;
    
    const versionCheckInterval = setInterval(() => {
      checkForFormVersionUpdate();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(versionCheckInterval);
  }, [form?.id, currentFormVersion]);

  const handleResponseChange = (questionId: string, value: any) => {
    console.log('🔄 Main question response changed:', {
      questionId,
      value,
      currentSection: currentSection?.title,
      allResponses: { ...responses, [questionId]: value }
    });
    
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleConditionalChange = (questionId: string, value: any) => {
    console.log('🔄 Conditional response changed:', {
      questionId,
      value,
      currentSection: currentSection?.title,
      allConditionalResponses: { ...conditionalResponses, [questionId]: value }
    });
    
    setConditionalResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Helper function to evaluate section conditionals
  const shouldShowSection = (section: any, responses: Record<string, any>) => {
    // If section is not marked as conditional, show it
    if (!section.conditional) {
      return true;
    }

    // For conditional sections, check if they are assigned to question options
    // If assigned to question options, they should only show when the option is selected
    // If not assigned to question options, they should show by default
    
    // Check if this section is assigned to any question option
    const isAssignedToQuestion = form?.sections
      ?.flatMap(s => s.questions)
      ?.some(question => {
        if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
          const options = question.options || [];
          return options.some((opt: any) => opt.assignedSectionId === section.id);
        }
        return false;
      });

    if (isAssignedToQuestion) {
      // This section is assigned to a question option, only show if that option is selected
      for (const [questionId, response] of Object.entries(responses)) {
        const question = form?.sections
          ?.flatMap(s => s.questions)
          ?.find(q => q.id === questionId);
        
        if (question && (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE')) {
          const options = question.options || [];
          
          if (question.type === 'SINGLE_CHOICE') {
            // Single choice: check if selected option has this section assigned
            const selectedOption = options.find((opt: any) => opt.value === response);
            if (selectedOption?.assignedSectionId === section.id) {
              return true;
            }
          } else if (question.type === 'MULTIPLE_CHOICE') {
            // Multiple choice: check if any selected option has this section assigned
            const selectedValues = Array.isArray(response) ? response : [response];
            const hasAssignedSection = selectedValues.some(selectedValue => {
              const selectedOption = options.find((opt: any) => opt.value === selectedValue);
              return selectedOption?.assignedSectionId === section.id;
            });
            if (hasAssignedSection) {
              return true;
            }
          }
        }
      }
      return false; // Don't show if assigned to question but option not selected
    } else {
      // This conditional section is not assigned to any question option, show it by default
      return true;
    }
  };

  // Get visible sections based on conditional logic (excluding assigned sections)
  const getVisibleSections = (sections: any[], responses: Record<string, any>) => {
    return sections.filter(section => {
      // Don't show sections that are assigned to question options (they render inline)
      if (section.conditional) {
        // Check if this section is assigned to any question option
        const isAssignedToQuestion = form?.sections
          ?.flatMap(s => s.questions)
          ?.some(question => {
            if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
              const options = question.options || [];
              return options.some((opt: any) => opt.assignedSectionId === section.id);
            }
            return false;
          });
        
        if (isAssignedToQuestion) {
          return false; // Don't show in main navigation, it will render inline
        }
      }
      
      // Show sections that are not conditional or have other conditional logic
      return shouldShowSection(section, responses);
    });
  };

  // Get assigned section for a question option
  const getAssignedSectionForQuestion = (question: any, responses: Record<string, any>) => {
    if (!question || (question.type !== 'SINGLE_CHOICE' && question.type !== 'MULTIPLE_CHOICE')) {
      return null;
    }

    const response = responses[question.id];
    if (!response) return null;

    const options = question.options || [];
    
    if (question.type === 'SINGLE_CHOICE') {
      const selectedOption = options.find((opt: any) => opt.value === response);
      if (selectedOption?.assignedSectionId) {
        return form?.sections?.find(section => section.id === selectedOption.assignedSectionId);
      }
    } else if (question.type === 'MULTIPLE_CHOICE') {
      const selectedValues = Array.isArray(response) ? response : [response];
      for (const selectedValue of selectedValues) {
        const selectedOption = options.find((opt: any) => opt.value === selectedValue);
        if (selectedOption?.assignedSectionId) {
          return form?.sections?.find(section => section.id === selectedOption.assignedSectionId);
        }
      }
    }

    return null;
  };

  // Validate current section including conditional questions
  const validateCurrentSection = () => {
    if (!form || !currentSection) return true;
    
    const allResponses = { ...responses, ...conditionalResponses };
    const errors: Record<string, string> = {};
    // Backwards compatible: check if section is repeatable, default to false for existing forms
    const isRepeatable = (currentSection as any).conditional?.repeatable === true;
    const instanceCount = getSectionInstanceCount(currentSection.id);
    
    console.log('🔍 Section conditional check:', {
      sectionId: currentSection.id,
      sectionTitle: currentSection.title,
      conditional: currentSection.conditional,
      isRepeatable,
      conditionalType: typeof currentSection.conditional,
      conditionalKeys: currentSection.conditional ? Object.keys(currentSection.conditional) : 'no conditional'
    });
    
    console.log('🔍 Section validation - Starting validation:', {
      sectionTitle: currentSection.title,
      isRepeatable,
      instanceCount,
      availableResponses: Object.keys(responses),
      availableConditionalResponses: Object.keys(conditionalResponses)
    });
    
    // Validate each instance of the section
    for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
      filterMainQuestions(currentSection.questions).forEach((question: FormQuestion) => {
        if (question.isRequired) {
          const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
          const response = responses[questionId];
          
          console.log('🔍 Validating question:', {
            questionId,
            questionTitle: question.title,
            isRequired: question.isRequired,
            response,
            responseType: typeof response,
            isEmpty: response === undefined || response === '' || response === null || (Array.isArray(response) && response.length === 0)
          });
          
          if (response === undefined || response === '' || response === null ||
              (Array.isArray(response) && response.length === 0)) {
            errors[questionId] = 'This field is required';
            console.log('❌ Validation error for question:', questionId, question.title);
          } else {
            console.log('✅ Question valid:', questionId, question.title);
          }
        }
        
        // Validate conditional questions within choice options
        if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && question.options) {
          const choiceQuestion = question as any;
          const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
          const selectedValues = responses[questionId];
          
          // For single choice, selectedValues is a string
          // For multiple choice, selectedValues is an array
          const selectedOptions = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
          
          choiceQuestion.options.forEach((option: any) => {
            if (option.conditionalQuestions && option.conditionalQuestions.length > 0) {
              // Check if this option is selected
              const isOptionSelected = selectedOptions.includes(option.value);
              
              if (isOptionSelected) {
                // Validate all conditional questions for this option
                option.conditionalQuestions.forEach((conditionalQuestion: any) => {
                  if (conditionalQuestion.isRequired) {
                    const conditionalQuestionId = isRepeatable ? 
                      getInstanceScopedQuestionId(conditionalQuestion.id, instanceIndex) : 
                      conditionalQuestion.id;
                    const conditionalResponse = conditionalResponses[conditionalQuestionId];
                    
                    if (conditionalResponse === undefined || conditionalResponse === '' || conditionalResponse === null ||
                        (Array.isArray(conditionalResponse) && conditionalResponse.length === 0)) {
                      errors[conditionalQuestionId] = `${conditionalQuestion.title} is required`;
                    }
                  }
                });
              }
            }
          });
        }
      });
    }
    
    console.log('🔍 Section validation - Final result:', {
      sectionTitle: currentSection.title,
      isRepeatable,
      instanceCount,
      errors: Object.keys(errors),
      errorCount: Object.keys(errors).length,
      isValid: Object.keys(errors).length === 0,
      allResponses: Object.keys(allResponses),
      mainResponses: Object.keys(responses),
      conditionalResponses: Object.keys(conditionalResponses)
    });
    
    return Object.keys(errors).length === 0;
  };

  // Get validation errors for current section
  const getSectionValidationErrors = () => {
    if (!form || !currentSection) return [];
    
    const errors: Array<{ questionId: string; questionTitle: string; error: string; instanceIndex?: number }> = [];
    // Backwards compatible: check if section is repeatable, default to false for existing forms
    const isRepeatable = (currentSection as any).conditional?.repeatable === true;
    const instanceCount = getSectionInstanceCount(currentSection.id);
    
    console.log('🔍 Error display - Section conditional check:', {
      sectionId: currentSection.id,
      sectionTitle: currentSection.title,
      conditional: currentSection.conditional,
      isRepeatable,
      conditionalType: typeof currentSection.conditional,
      conditionalKeys: currentSection.conditional ? Object.keys(currentSection.conditional) : 'no conditional'
    });
    
    console.log('🔍 Getting validation errors:', {
      sectionTitle: currentSection.title,
      isRepeatable,
      instanceCount,
      availableResponses: Object.keys(responses)
    });
    
    // Check each instance of the section
    for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
      filterMainQuestions(currentSection.questions).forEach((question: FormQuestion) => {
        if (question.isRequired) {
          const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
          const response = responses[questionId];
          
          console.log('🔍 Checking question for errors:', {
            questionId,
            questionTitle: question.title,
            response,
            isEmpty: response === undefined || response === '' || response === null || (Array.isArray(response) && response.length === 0)
          });
          
          if (response === undefined || response === '' || response === null ||
              (Array.isArray(response) && response.length === 0)) {
            errors.push({
              questionId: questionId,
              questionTitle: `${question.title}${isRepeatable ? ` (Instance ${instanceIndex + 1})` : ''}`,
              error: 'This field is required',
              instanceIndex: isRepeatable ? instanceIndex : undefined
            });
            console.log('❌ Added error for question:', questionId, question.title);
          }
        }
        
        // Check conditional questions within choice options
        if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && question.options) {
          const choiceQuestion = question as any;
          const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
          const selectedValues = responses[questionId];
          const selectedOptions = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
          
          choiceQuestion.options.forEach((option: any) => {
            if (option.conditionalQuestions && option.conditionalQuestions.length > 0) {
              const isOptionSelected = selectedOptions.includes(option.value);
              
              if (isOptionSelected) {
                option.conditionalQuestions.forEach((conditionalQuestion: any) => {
                  if (conditionalQuestion.isRequired) {
                    const conditionalQuestionId = isRepeatable ? 
                      getInstanceScopedQuestionId(conditionalQuestion.id, instanceIndex) : 
                      conditionalQuestion.id;
                    const conditionalResponse = conditionalResponses[conditionalQuestionId];
                    
                    if (conditionalResponse === undefined || conditionalResponse === '' || conditionalResponse === null ||
                        (Array.isArray(conditionalResponse) && conditionalResponse.length === 0)) {
                      errors.push({
                        questionId: conditionalQuestionId,
                        questionTitle: `${conditionalQuestion.title}${isRepeatable ? ` (Instance ${instanceIndex + 1})` : ''}`,
                        error: 'This field is required',
                        instanceIndex: isRepeatable ? instanceIndex : undefined
                      });
                    }
                  }
                });
              }
            }
          });
        }
      });
    }
    
    console.log('🔍 Final validation errors:', {
      errorCount: errors.length,
      errors: errors.map(e => ({ questionId: e.questionId, questionTitle: e.questionTitle }))
    });
    
    return errors;
  };

  const handleNextSection = () => {
    const visibleSections = getVisibleSections(form?.sections || [], responses);
    if (currentSectionIndex < visibleSections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!form || isSubmitting) return; // Prevent double submissions

    setIsSubmitting(true);
    
    try {
      console.log('📤 Submitting form response for form:', form.id);
      
      // Create the response object and submit via addFormResponseToStorage 
      // (which handles online/offline scenarios and API submission)
      // Process repeatable sections to create multiple responses
      const responsesToSubmit: Array<{ data: Record<string, any>; repeatableSectionId?: string; instanceIndex?: number }> = [];

      console.log('🔄 Form submission - Processing repeatable sections:', {
        formId: form.id,
        sectionInstanceCounts,
        rawResponses: Object.keys(responses).length
      });

      if (form) {
        // Find repeatable sections and their instance counts
        const repeatableSections = form.sections.filter(section => 
          (section as any).conditional?.repeatable
        );

        if (repeatableSections.length === 0) {
          // No repeatable sections - create single response with all data
          const singleResponse: Record<string, any> = {};
          form.sections.forEach(section => {
            section.questions.forEach((question: FormQuestion) => {
              singleResponse[question.id] = responses[question.id];
            });
          });
          responsesToSubmit.push({ data: singleResponse });
        } else {
          // Create separate responses for each instance of repeatable sections
          const maxInstances = Math.max(...repeatableSections.map(section => 
            getSectionInstanceCount(section.id)
          ));

          console.log('📊 Creating multiple responses:', {
            repeatableSections: repeatableSections.length,
            maxInstances,
            repeatableSectionIds: repeatableSections.map(s => s.id)
          });

          for (let instanceIndex = 0; instanceIndex < maxInstances; instanceIndex++) {
            const responseData: Record<string, any> = {};
            
            form.sections.forEach(section => {
              const isRepeatable = (section as any).conditional?.repeatable;
              const instanceCount = getSectionInstanceCount(section.id);
              
              section.questions.forEach((question: FormQuestion) => {
                if (isRepeatable) {
                  // For repeatable sections, use instance-scoped values
                  const scopedId = getInstanceScopedQuestionId(question.id, instanceIndex);
                  responseData[question.id] = responses[scopedId];
                } else {
                  // For non-repeatable sections, use the same value in all responses
                  responseData[question.id] = responses[question.id];
                }
              });
            });

            // Only create response if there's actual data for this instance
            const hasData = Object.values(responseData).some(value => 
              value !== undefined && value !== null && value !== ''
            );

            if (hasData) {
              responsesToSubmit.push({ 
                data: responseData, 
                repeatableSectionId: repeatableSections[0].id, // Primary repeatable section
                instanceIndex 
              });
              
              console.log(`📝 Response ${instanceIndex + 1} data:`, {
                instanceIndex,
                dataKeys: Object.keys(responseData),
                hasData: true
              });
            }
          }
        }
      }

      console.log('📤 Total responses to submit:', responsesToSubmit.length);
      
      // Submit each response individually
      const submissionPromises = responsesToSubmit.map(async (responseData, index) => {
        // Add conditional responses to this specific response
        const mergedResponses = { ...responseData.data };
        
        Object.entries(conditionalResponses).forEach(([conditionalQuestionId, value]) => {
          // Find the parent question that contains this conditional question
          const parentQuestion = form.sections
            .flatMap(section => section.questions)
            .find(question => {
              if ((question as any).options && Array.isArray((question as any).options)) {
                return (question as any).options.some((option: any) => 
                  option.conditionalQuestions && 
                  option.conditionalQuestions.some((condQ: any) => condQ.id === conditionalQuestionId)
                );
              }
              return false;
            });
          
          if (parentQuestion) {
            // Store conditional response as part of parent question's response
            const parentResponse = mergedResponses[parentQuestion.id];
            
            if (parentResponse === undefined || parentResponse === null) {
              // Parent question has no response yet, create object with conditional response
              mergedResponses[parentQuestion.id] = {
                [conditionalQuestionId]: value
              };
            } else if (typeof parentResponse === 'object' && !Array.isArray(parentResponse)) {
              // Parent response is already an object, add conditional response to it
              mergedResponses[parentQuestion.id][conditionalQuestionId] = value;
            } else {
              // Parent response is a simple value, convert to object with both parent and conditional responses
              mergedResponses[parentQuestion.id] = {
                _parentValue: parentResponse,
                [conditionalQuestionId]: value
              };
            }
          }
        });

        // Create source with metadata for repeatable sections
        let sourceData = isEmbedded ? 'embed' : 'direct';
        if (responseData.repeatableSectionId) {
          sourceData = JSON.stringify({
            type: 'repeatable',
            repeatableSectionId: responseData.repeatableSectionId,
            instanceIndex: responseData.instanceIndex,
            originalSource: isEmbedded ? 'embed' : 'direct'
          });
        }

        const responseObj = {
          id: `response-${Date.now()}-${index}`,
          formId: form.id,
          formVersion: form.version || 1,
          startedAt: new Date(),
          submittedAt: new Date(),
          isComplete: true,
          data: mergedResponses,
          ipAddress: 'Unknown',
          userAgent: navigator.userAgent,
          source: sourceData
        };

        console.log(`📊 Response ${index + 1} data:`, {
          responseId: responseObj.id,
          repeatableSectionId: responseData.repeatableSectionId,
          instanceIndex: responseData.instanceIndex,
          dataKeys: Object.keys(mergedResponses)
        });
        
        return addFormResponseToStorage(responseObj);
      });

      // Submit all responses
      const submissionResults = await Promise.all(submissionPromises);
      const submitted = submissionResults.every(result => result);
      
      // Clear draft data
      clearFormPreviewData(form.id);
      
      setIsComplete(true);
      
      // Success toast with multiple responses info
      const responseCount = responsesToSubmit.length;
      if (responseCount > 1) {
        toast({
          title: submitted ? "Multiple Responses Submitted!" : "Saved Offline",
          description: submitted 
            ? `Successfully submitted ${responseCount} responses. ${form.settings?.thankYouMessage || "Thank you for your responses."}`
            : `Saved ${responseCount} responses offline. They will auto-submit when connection is restored.`,
        });
      } else {
        // Single response - use existing logic
        if (form.settings?.thankYouMessage && form.settings.thankYouMessage !== "Thank you for your response.") {
          toast({
            title: submitted ? "Form Submitted Successfully!" : "Saved Offline",
            description: submitted ? form.settings.thankYouMessage : `${form.settings.thankYouMessage} (Will auto-submit when online)`,
          });
        } else if (!submitted) {
          toast({
            title: "Saved Offline",
            description: "We'll auto-submit your response once connection is restored.",
          });
        }
      }
    } catch (err: any) {
      console.error('Form submission failed:', err);
      toast({
        title: "Submission Failed",
        description: err.message || "Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginRedirect = () => {
    // Preserve return path to this public form
    const next = encodeURIComponent(`/fill/${formId}`);
    navigate(`/login?next=${next}`);
  };

  const saveDraft = () => {
    if (form?.id) {
      const previewData: Omit<FormPreviewData, 'formId'> = {
        responses,
        currentSection: currentSectionIndex,
        isComplete: false,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      saveFormPreviewData(form.id, previewData);
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved. You can continue later.",
      });
    }
  };

  const handleReloadForUpdate = () => {
    // Save current progress before reloading
    if (form?.id) {
      const previewData: Omit<FormPreviewData, 'formId'> = {
        responses,
        currentSection: currentSectionIndex,
        isComplete: false,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      saveFormPreviewData(form.id, previewData);
    }
    
    // Reload the page to get the latest form version
    window.location.reload();
  };

  const handleDismissVersionUpdate = () => {
    setShowVersionUpdatePrompt(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Form Not Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            {requiresAuth && (
              <div className="mt-4">
                <Button onClick={handleLoginRedirect} className="w-full">Login to continue</Button>
              </div>
            )}
            <div className="mt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form) {
    return null;
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Form Submitted Successfully!</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">
              {form.settings?.thankYouMessage || "Thank you for your response. Your submission has been received."}
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  // Reset form state for new response
                  setResponses({});
                  setCurrentSectionIndex(0);
                  setIsComplete(false);
                  setShowProgress(true);
                  // Clear any saved draft data
                  if (form?.id) {
                    clearFormPreviewData(form.id);
                  }
                }}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Submit Another Response
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get visible sections based on current responses
  const visibleSections = getVisibleSections(form.sections, responses);
  const currentSection = visibleSections[currentSectionIndex];
  
  // Debug logging to check conditional question filtering
  if (currentSection) {
    const allQuestions = currentSection.questions;
    const filteredQuestions = filterMainQuestions(allQuestions);
    const conditionalQuestions = allQuestions.filter((q: FormQuestion) => isConditionalQuestion(q, allQuestions));
    
    console.log('🔍 PublicFormFiller section analysis:', {
      sectionTitle: currentSection.title,
      totalQuestions: allQuestions.length,
      filteredQuestions: filteredQuestions.length,
      conditionalQuestions: conditionalQuestions.length,
      conditionalQuestionIds: conditionalQuestions.map((q: FormQuestion) => ({ 
        id: q.id, 
        title: q.title, 
        isConditional: (q as any).isConditional,
        configIsConditional: (q as any).config?.isConditional,
        checkResult: isConditionalQuestion(q, allQuestions)
      }))
    });
  }
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex === visibleSections.length - 1;
  const progress = visibleSections.length > 0 ? ((currentSectionIndex + 1) / visibleSections.length) * 100 : 0;

  // Safety check for currentSection
  if (!currentSection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Sections Available</h3>
              <p className="text-gray-600 mb-4">
                This form has no visible sections based on your responses.
              </p>
              <Button onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isEmbedded ? 'p-0' : 'p-4'}`}>
      <div className={`max-w-4xl mx-auto ${isEmbedded ? '' : 'py-8'}`}>
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {form.title}
                </CardTitle>
                {form.description && (
                  <p className="text-gray-600 mt-2">{form.description}</p>
                )}
              </div>
              {!isEmbedded && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProgress(!showProgress)}
                >
                  {showProgress ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </CardHeader>
          
          {showProgress && (
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span>{currentSectionIndex + 1} of {visibleSections.length} sections</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          )}
          {!isEmbedded && (
            <CardContent>
              {!isOnline ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    You are currently offline. Submissions will be saved locally and auto-submitted when connection is restored{syncStatus.pendingItems ? ` (pending: ${syncStatus.pendingItems})` : ''}.
                  </AlertDescription>
                </Alert>
              ) : (
                syncStatus.pendingItems > 0 && (
                  <Alert>
                    <AlertDescription className="flex items-center justify-between w-full">
                      <span>
                        {syncStatus.isSyncing ? `Syncing ${syncStatus.pendingItems} pending item(s)...` : `${syncStatus.pendingItems} pending item(s) ready to sync.`}
                      </span>
                      <div className="flex items-center gap-2">
                        {syncStatus.isSyncing && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                        )}
                        <Button variant="outline" size="sm" onClick={processOfflineQueue} disabled={syncStatus.isSyncing}>
                          Sync now
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )
              )}
            </CardContent>
          )}
        </Card>

        {/* Version Update Prompt */}
        {showVersionUpdatePrompt && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Form Update Available
                  </h4>
                  <p className="text-sm text-blue-700 mb-3">
                    A new version of this form (v{latestFormVersion}) is available. 
                    Your current progress will be saved before reloading.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleReloadForUpdate}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      Reload to Update
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDismissVersionUpdate}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {currentSection.title}
            </CardTitle>
            {currentSection.description && (
              <p className="text-gray-600">{currentSection.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Render repeatable instances of current section */}
              {Array.from({ length: getSectionInstanceCount(currentSection.id) }).map((_, instanceIndex) => (
                <div key={`${currentSection.id}-instance-${instanceIndex}`} className="space-y-6 border rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Instance {instanceIndex + 1}</div>
                    {getSectionInstanceCount(currentSection.id) > 1 && (currentSection as any).conditional?.repeatable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSectionInstanceCount(currentSection.id, getSectionInstanceCount(currentSection.id) - 1)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {filterMainQuestions(currentSection.questions).map((question: FormQuestion) => {
                    const scopedId = getInstanceScopedQuestionId(question.id, instanceIndex);
                // Debug logging to check if conditional questions are being filtered correctly
                console.log('🔍 PublicFormFiller rendering main question:', {
                  questionId: question.id,
                  questionTitle: question.title,
                  questionType: question.type,
                  isConditionalDirect: (question as any).isConditional,
                  isConditionalConfig: (question as any).config?.isConditional,
                  isConditionalCheck: isConditionalQuestion(question, currentSection.questions),
                  shouldBeFiltered: isConditionalQuestion(question, currentSection.questions),
                  totalQuestions: currentSection.questions.length,
                  filteredQuestions: filterMainQuestions(currentSection.questions).length
                });
                
                const assignedSection = getAssignedSectionForQuestion(question, responses);
                
                return (
                  <div key={scopedId} className="space-y-4">
                    <ErrorBoundary
                      fallback={
                        <Alert variant="destructive" className="my-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Error loading question: {question.title}. Please refresh the page or contact support.
                          </AlertDescription>
                        </Alert>
                      }
                    >
                      <QuestionRenderer
                        question={question}
                        value={responses[scopedId]}
                        onChange={(value) => handleResponseChange(scopedId, value)}
                        error={undefined}
                        isPreviewMode={false}
                        conditionalValues={conditionalResponses}
                        onConditionalChange={handleConditionalChange}
                      />
                    </ErrorBoundary>

                    {/* Inline Assigned Section */}
                    {assignedSection && (
                      <Card className="border-blue-200 bg-blue-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg text-blue-900 flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            {assignedSection.title}
                          </CardTitle>
                          {assignedSection.description && (
                            <p className="text-blue-700 text-sm">{assignedSection.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {assignedSection.questions.map((inlineQuestion) => (
                              <ErrorBoundary
                                key={`${inlineQuestion.id}-i${instanceIndex}`}
                                fallback={
                                  <Alert variant="destructive" className="my-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                      Error loading question: {inlineQuestion.title}
                                    </AlertDescription>
                                  </Alert>
                                }
                              >
                                {(() => {
                                  const inlineScopedId = getInstanceScopedQuestionId(inlineQuestion.id, instanceIndex);
                                  return (
                                <QuestionRenderer
                                  question={inlineQuestion}
                                    value={responses[inlineScopedId]}
                                    onChange={(value) => handleResponseChange(inlineScopedId, value)}
                                  error={undefined}
                                  isPreviewMode={false}
                                  conditionalValues={conditionalResponses}
                                  onConditionalChange={handleConditionalChange}
                                />
                                  );
                                })()}
                              </ErrorBoundary>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
                  })}
                </div>
              ))}
              {(currentSection as any).conditional?.repeatable === true && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSectionInstanceCount(currentSection.id, getSectionInstanceCount(currentSection.id) + 1)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add another {currentSection.title}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Validation Errors */}
        {!validateCurrentSection() && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-2">
                    Please complete the required fields below:
                  </h4>
                  <ul className="space-y-1">
                    {getSectionValidationErrors().map((error, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></span>
                        <span className="font-medium">{error.questionTitle}</span>
                        <span className="text-red-600">- {error.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {!isFirstSection && (
              <Button 
                variant="outline" 
                onClick={handlePrevSection}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={saveDraft}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
          </div>

          <div className="flex gap-2">
            {!isLastSection ? (
              <Button 
                onClick={handleNextSection}
                disabled={!validateCurrentSection()}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !validateCurrentSection()}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Form
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Form Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Auto-save enabled</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>{Object.keys(responses).length} questions answered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Save, AlertCircle } from 'lucide-react';
import { QuestionRenderer } from './QuestionRenderer';
import { Form, FormQuestion, FormResponse } from '../form-creation-wizard/types';
import { filterMainQuestions, getNumberQuestionRangeError } from './utils/questionUtils';

import { toast } from '@/hooks/use-toast';
import { useForm } from '@/contexts/FormContext';
import { 
  saveFormPreviewData, 
  loadFormPreviewData, 
  clearFormPreviewData,
  FormPreviewData,
  getFormById
} from '@/lib/formLocalStorageUtils';

interface FormPreviewProps {
  form?: Form; // If provided, use this form instead of loading from URL
  isPreviewMode?: boolean; // If true, responses won't be saved
  onSubmit?: (response: FormResponse) => void; // Custom submit handler
  onBack?: () => void; // Custom back handler
  isDialog?: boolean; // If true, adjust layout for dialog display
  // Edit mode props
  editMode?: boolean; // If true, editing an existing response
  existingResponse?: FormResponse; // The response being edited
  onUpdate?: (updatedResponse: FormResponse) => void; // Handler for updates
  externalLoading?: boolean; // External loading state (e.g., from parent modal)
}

export function FormPreview({ 
  form: providedForm, 
  isPreviewMode = false, 
  onSubmit,
  onBack,
  isDialog = false,
  editMode = false,
  existingResponse,
  onUpdate,
  externalLoading = false
}: FormPreviewProps) {
  const { projectId, formId } = useParams();
  const navigate = useNavigate();
  const { currentForm, addFormResponse, validateConditionalQuestions } = useForm();
  
  const [form, setForm] = useState<Form | null>(providedForm || null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [conditionalResponses, setConditionalResponses] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use form from context if available, otherwise fall back to provided form or URL params
  useEffect(() => {
    if (currentForm) {
      setForm(currentForm);
    } else if (providedForm) {
      setForm(providedForm);
    } else if (formId) {
      setIsLoading(true);
      // Load form from local storage using formId
      const loadedForm = getFormById(formId);
      if (loadedForm) {
        setForm(loadedForm);
      } else {
        // Fallback to sample form if form not found
        const sampleForm: Form = {
          id: formId,
          title: 'Sample Form',
          description: 'This is a preview of your form as it will appear to respondents.',
          projectId: projectId || '',
          createdBy: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'PUBLISHED',
          version: 1,
          sections: [],
          settings: {
            requireAuthentication: false,
            thankYouMessage: 'Thank you for your response!',
            notificationEmails: [],
          },
          responseCount: 0,
          tags: []
        };
        setForm(sampleForm);
      }
      setIsLoading(false);
    }
  }, [currentForm, providedForm, formId, projectId]);

  // Load saved preview data when form changes or existing response in edit mode
  useEffect(() => {
    if (form?.id) {
      if (editMode && existingResponse) {
        // In edit mode, load the existing response data
        setResponses(existingResponse.data || {});
        setCurrentSectionIndex(0); // Start from first section
        setIsDraft(false); // This is an existing response, not a draft
      } else if (!isPreviewMode) {
        // Normal mode - load saved draft data
        const savedData = loadFormPreviewData(form.id);
        if (savedData) {
          setResponses(savedData.responses);
          setCurrentSectionIndex(savedData.currentSection);
          setIsDraft(true);
        }
      }
    }
  }, [form?.id, isPreviewMode, editMode, existingResponse]);

  // Auto-save preview data when responses change (but not in edit mode)
  useEffect(() => {
    if (form?.id && !isPreviewMode && !editMode && Object.keys(responses).length > 0) {
      const previewData: Omit<FormPreviewData, 'formId'> = {
        responses,
        currentSection: currentSectionIndex,
        isComplete: false,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      saveFormPreviewData(form.id, previewData);
    }
  }, [form?.id, responses, currentSectionIndex, isPreviewMode, editMode]);

  // Get all questions from all sections
  const allQuestions = form?.sections.flatMap(section => section.questions) || [];
  const currentSection = form?.sections[currentSectionIndex];
  const totalSections = form?.sections.length || 0;
  const isLastSection = currentSectionIndex === totalSections - 1;

  // Calculate progress
  const answeredQuestions = Object.keys(responses).length;
  const totalQuestions = allQuestions.length;
  const progressPercentage = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  // Handle question response
  const handleQuestionChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear error if question now has a value
    if (value !== undefined && value !== '' && value !== null) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }

    // Clear stale conditional answers from previously-selected options
    const question = form?.sections?.flatMap(s => s.questions || []).find(q => q.id === questionId);
    if (question && (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE')) {
      const options = (question as any).options as any[] | undefined;
      if (options) {
        const selectedValues = Array.isArray(value) ? value.map(String) : [String(value)];
        const idsToRemove: string[] = [];
        options.forEach((opt: any) => {
          if (!opt.conditionalQuestions?.length) return;
          const isSelected = selectedValues.includes(opt.value?.toString());
          if (!isSelected) {
            opt.conditionalQuestions.forEach((cq: any) => idsToRemove.push(cq.id));
          }
        });
        if (idsToRemove.length > 0) {
          setConditionalResponses(prev => {
            const next = { ...prev };
            idsToRemove.forEach(id => delete next[id]);
            return next;
          });
        }
      }
    }
  };

  // Handle conditional question response
  const handleConditionalChange = (questionId: string, value: any) => {
    console.log('🔄 FormPreview handleConditionalChange called:', {
      questionId,
      value,
      currentConditionalResponses: conditionalResponses
    });
    
    setConditionalResponses(prev => {
      const newResponses = {
        ...prev,
        [questionId]: value
      };
      console.log('🔄 Updated conditionalResponses:', newResponses);
      return newResponses;
    });
  };

  // Validate current section
  const validateCurrentSection = () => {
    if (!currentSection || !form) return true;
    
    const newErrors: Record<string, string> = {};
    
    // Validate main questions (same set as rendered in the section)
    filterMainQuestions(currentSection.questions).forEach(question => {
      const response = responses[question.id];
      const empty =
        response === undefined ||
        response === '' ||
        response === null ||
        (Array.isArray(response) && response.length === 0);

      let fieldError: string | undefined;
      if (question.isRequired && empty) {
        fieldError = 'This field is required';
      } else {
        fieldError = getNumberQuestionRangeError(question, response);
      }
      if (fieldError) newErrors[question.id] = fieldError;
    });

    // Validate conditional questions
    const conditionalErrors = validateConditionalQuestions(form, { ...responses, ...conditionalResponses });
    Object.assign(newErrors, conditionalErrors);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigate to next section
  const handleNext = () => {
    if (validateCurrentSection() && currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };

  // Navigate to previous section
  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    setIsDraft(true);
    
    if (isPreviewMode) {
      toast({
        title: "Draft Saved (Preview Mode)",
        description: "In preview mode, drafts are not actually saved.",
      });
      return;
    }

    // In a real app, this would save to API
    toast({
      title: "Draft Saved",
      description: "Your responses have been saved. You can continue later.",
    });
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateCurrentSection()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (editMode && existingResponse && onUpdate) {
        // In edit mode, update the existing response
        const updatedResponse: FormResponse = {
          ...existingResponse,
          data: {
            ...responses,
            ...conditionalResponses
          },
          isComplete: true
        };

        onUpdate(updatedResponse);
        toast({
          title: "Response Updated",
          description: "The form response has been successfully updated.",
        });
      } else {
        // Create new response (normal mode)
        const formResponse: FormResponse = {
          id: `response-${Date.now()}`,
          formId: form!.id,
          formVersion: form!.version,
          startedAt: new Date(),
          submittedAt: new Date(),
          isComplete: true,
          data: {
            ...responses,
            ...conditionalResponses
          }
        };

        if (onSubmit) {
          onSubmit(formResponse);
        } else if (isPreviewMode) {
          // Add response to context for preview/testing
          addFormResponse(formResponse);
          toast({
            title: "Form Submitted (Preview Mode)",
            description: "In preview mode, responses are not actually saved.",
          });
        } else {
          // In a real app, this would submit to API
          toast({
            title: "Form Submitted",
            description: "Thank you for your response!",
          });
        }

        // Clear localStorage data after successful submission
        if (form?.id && !isPreviewMode) {
          clearFormPreviewData(form.id);
        }
      }

      // Navigate to thank you page or back
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Form...</h3>
              <p className="text-gray-600">
                Please wait while we load your form.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Form Not Found</h3>
              <p className="text-gray-600 mb-4">
                The requested form could not be loaded.
              </p>
              <Button onClick={handleBack}>
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
    <div className={`${isDialog ? 'p-6' : 'min-h-screen bg-gray-50 py-8'}`}>
      <div className={`${isDialog ? 'max-w-full' : 'max-w-4xl mx-auto px-4'}`}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {!isDialog && (
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            
            {isPreviewMode && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Preview Mode
              </Badge>
            )}
            {editMode && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Edit Mode
              </Badge>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {form.title}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-lg">
                {form.description}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {totalSections > 1 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Section {currentSectionIndex + 1} of {totalSections}</span>
                  <span>{Math.round(progressPercentage)}% Complete</span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
                {currentSection && (
                  <p className="text-sm font-medium text-gray-700">
                    {currentSection.title}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Section */}
        {currentSection && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl">
                {currentSection.title}
              </CardTitle>
              {currentSection.description && (
                <p className="text-gray-600">
                  {currentSection.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-8">
              {filterMainQuestions(currentSection.questions).map((question) => {
                console.log('🔍 FormPreview rendering main question:', {
                  questionId: question.id,
                  questionTitle: question.title,
                  questionType: question.type,
                  hasConditionalQuestions: (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') 
                    ? (question as any).options?.some((opt: any) => opt.hasConditionalQuestions) 
                    : false,
                  conditionalValues: conditionalResponses,
                  onConditionalChange: !!handleConditionalChange
                });
                
                return (
                  <div key={question.id}>
                    <QuestionRenderer
                      question={question}
                      value={responses[question.id]}
                      onChange={(value) => handleQuestionChange(question.id, value)}
                      error={errors[question.id]}
                      isPreviewMode={isPreviewMode}
                      conditionalValues={conditionalResponses}
                      onConditionalChange={handleConditionalChange}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentSectionIndex === 0}
                >
                  Previous
                </Button>
              </div>

              <div className="flex gap-2">
                {!editMode && (
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </Button>
                )}

                {isLastSection ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || externalLoading}
                    className="flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {(isSubmitting || externalLoading)
                      ? (editMode ? 'Updating...' : 'Submitting...') 
                      : (editMode ? 'Update Response' : 'Submit Form')
                    }
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={isSubmitting}
                  >
                    Next Section
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
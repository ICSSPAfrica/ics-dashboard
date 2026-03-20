import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Save, Eye, X, Download, Share2, Loader2, CheckCircle } from 'lucide-react';
import { useFormWizard } from './hooks/useFormWizard';
import { ActivityKPIMapping } from './types';
import { BasicInfoStep } from './BasicInfoStep';
import { SectionsStep } from './SectionsStep';
import { QuestionsStep } from './QuestionsStep';
import { ActivityLinksStep } from './ActivityLinksStep';
import { SettingsStep } from './SettingsStep';
import { ReviewStep } from './ReviewStep';
import { useForm } from '@/contexts/FormContext';
import { FormPreview } from '../form-preview/FormPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatFormWizardDraftAge, getFormWizardDraftAge } from '@/lib/formLocalStorageUtils';
import { toast } from '@/hooks/use-toast';

interface FormCreationWizardProps {
  formId?: string; // For editing existing forms
}

export function FormCreationWizard({ formId }: FormCreationWizardProps) {
  const {
    wizardState,
    steps,
    nextStep,
    prevStep,
    goToStep,
    validateCurrentStep,
    updateBasicInfo,
    addSection,
    updateSection,
    removeSection,
    reorderSections,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    reorderQuestions,
    linkQuestionToActivity,
    linkQuestionToActivities,
    updateSettings,
    saveDraft,
    publishForm,
    isPublishing,
    hasDraft,
    clearDraft,
    navigate,
  } = useFormWizard(formId);

  const { form, availableProjects, availableActivities, currentStep, hasUnsavedChanges } = wizardState;
  const { setCurrentForm, setHasUnsavedChanges: setContextHasUnsavedChanges, setIsPreviewMode } = useForm();
  const [showPreview, setShowPreview] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  const [draftAgeText, setDraftAgeText] = useState('');
  const [showCopyPopup, setShowCopyPopup] = useState(false);

  // Check for draft on component mount
  useEffect(() => {
    if (!wizardState.isEditing && hasDraft()) {
      setShowDraftAlert(true);
      const draftAge = getFormWizardDraftAge();
      if (draftAge) {
        setDraftAgeText(formatFormWizardDraftAge(draftAge));
      }
    }
  }, [wizardState.isEditing, hasDraft]);

  // Sync form data with context
  useEffect(() => {
    setCurrentForm(form);
  }, [form, setCurrentForm]);

  // Sync unsaved changes with context
  useEffect(() => {
    setContextHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setContextHasUnsavedChanges]);

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'basic-info':
        return (
          <BasicInfoStep
            form={form}
            availableProjects={availableProjects}
            onUpdate={updateBasicInfo}
          />
        );
      
      case 'sections':
        return (
          <SectionsStep
            sections={form.sections || []}
            onAddSection={addSection}
            onUpdateSection={updateSection}
            onRemoveSection={removeSection}
            onReorderSections={reorderSections}
          />
        );
      
      case 'questions':
        return (
          <QuestionsStep
            sections={form.sections || []}
            availableActivities={availableActivities as ActivityKPIMapping[]}
            isEditing={wizardState.isEditing}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onRemoveQuestion={removeQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onReorderQuestions={reorderQuestions}
            onLinkQuestionToActivity={linkQuestionToActivity}
            onLinkQuestionToActivities={linkQuestionToActivities}
          />
        );
      
      case 'activity-links':
        return (
          <ActivityLinksStep
            form={form}
            availableActivities={availableActivities as ActivityKPIMapping[]}
            onLinkQuestionToActivity={linkQuestionToActivity}
            onLinkQuestionToActivities={linkQuestionToActivities}
            onUpdateQuestion={updateQuestion}
          />
        );
      
      case 'settings':
        return (
          <SettingsStep
            settings={form.settings!}
            onUpdateSettings={updateSettings}
          />
        );
      
      case 'review':
        return (
          <ReviewStep
            form={form}
            onPublish={publishForm}
          />
        );
      
      default:
        return null;
    }
  };

  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => goToStep(index)}
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                index <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
              } ${index < currentStep ? 'cursor-pointer' : ''}`}
              disabled={index > currentStep}
            >
              {index + 1}
            </button>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                index <= currentStep ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
            {index < steps.length - 1 && (
              <div className={`mx-4 h-0.5 w-16 ${
                index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const isNextDisabled = !validateCurrentStep();
  const isLastStep = currentStep === steps.length - 1;

  const handleShareForm = async () => {
    if (form.id) {
      try {
        const baseUrl = window.location.origin;
        const formUrl = `${baseUrl}/fill/${form.id}`;
        await navigator.clipboard.writeText(formUrl);
        
        // Show popup feedback
        setShowCopyPopup(true);
        setTimeout(() => setShowCopyPopup(false), 2000);
        
        toast({
          title: "Link Copied!",
          description: "Form link has been copied to clipboard.",
          duration: 4000,
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Could not copy link to clipboard. Please try again.",
          variant: "destructive",
          duration: 4000,
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {wizardState.isEditing ? 'Edit Form' : 'Create New Form'}
              </h1>
              <p className="text-gray-600 mt-2">
                Build data collection forms and link them to your project activities
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Unsaved Changes
                </Badge>
              )}
              
              {form.status && (
                <Badge variant={form.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                  {form.status}
                </Badge>
              )}

              <Button
                variant="outline"
                onClick={saveDraft}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Edits
              </Button>

              {form.status === 'PUBLISHED' && form.id && (
                <Button
                  variant="outline"
                  onClick={handleShareForm}
                  className="flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share Form
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Draft Alert */}
        {showDraftAlert && !wizardState.isEditing && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Download className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <span>A draft of your form is available{draftAgeText && ` (saved ${draftAgeText})`}. You can restore it to continue where you left off.</span>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // The draft is already loaded by the hook, just hide the alert
                      setShowDraftAlert(false);
                    }}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    Restore Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      clearDraft();
                      setShowDraftAlert(false);
                    }}
                    className="text-red-600 border-red-300 hover:bg-red-100"
                  >
                    Clear Draft
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDraftAlert(false)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Steps */}
        <StepIndicator />

        {/* Step Content */}
        <Card className="min-h-[600px]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{steps[currentStep].title}</span>
              {form.title && (
                <Badge variant="outline" className="text-sm">
                  {form.title}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            
            {currentStep >= 2 && ( // Show preview from questions step onwards
              <Button 
                variant="outline"
                onClick={() => {
                  setIsPreviewMode(true);
                  setShowPreview(true);
                }}
                className="flex items-center gap-2"
                disabled={!form.id || !form.projectId || !form.sections?.some(s => s.questions.length > 0)}
              >
                <Eye className="w-4 h-4" />
                Preview
              </Button>
            )}
            
            {isLastStep ? (
              <Button 
                onClick={publishForm}
                className="flex items-center gap-2"
                disabled={!validateCurrentStep() || isPublishing}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publishing...
                  </>
                ) : wizardState.form.status === 'PUBLISHED' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {wizardState.isEditing ? 'Update Form' : 'Published'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {wizardState.isEditing ? 'Update Form' : 'Publish Form'}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={isNextDisabled}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Form Info Footer */}
        {form.id && (
          <div className="mt-8 p-4 bg-white rounded-lg border text-center">
            <p className="text-sm text-gray-600">
              Form ID: <span className="font-mono text-gray-800">{form.id}</span>
              {form.createdAt && (
                <span className="ml-4">
                  Created: {new Date(form.createdAt).toLocaleDateString()}
                </span>
              )}
              {form.updatedAt && form.updatedAt !== form.createdAt && (
                <span className="ml-4">
                  Last modified: {new Date(form.updatedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Form Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Form Preview</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            <FormPreview 
              isPreviewMode={true}
              onBack={() => setShowPreview(false)}
              isDialog={true}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Success Popup */}
      {showCopyPopup && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Link copied to clipboard!</span>
          </div>
        </div>
      )}
    </div>
  );
}
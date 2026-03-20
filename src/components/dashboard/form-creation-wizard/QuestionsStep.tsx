import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, Plus, HelpCircle, Layers, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormSection, FormQuestion, QuestionType, ActivityKPIMapping } from './types';
import { filterMainQuestions } from '../form-preview/utils/questionUtils';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_DESCRIPTIONS,
  QUESTION_TYPE_CATEGORIES,
  BaseQuestionEditor,
  ShortTextQuestionEditor,
  SingleChoiceQuestionEditor,
  MultipleChoiceQuestionEditor,
  NumberQuestionEditor,
  DateQuestionEditor,
  LikertScaleQuestionEditor,
  LocationQuestionEditor,
  MediaUploadQuestionEditor,
} from './question-types';
import { AddNextQuestionModal } from './AddNextQuestionModal';
import { toast } from '@/hooks/use-toast';

interface QuestionsStepProps {
  sections: FormSection[];
  availableActivities: ActivityKPIMapping[];
  isEditing?: boolean;
  onAddQuestion: (sectionId: string, questionType: QuestionType, afterQuestionId?: string) => void;
  onUpdateQuestion: (sectionId: string, questionId: string, updates: Partial<FormQuestion>) => void;
  onRemoveQuestion: (sectionId: string, questionId: string) => void;
  onDuplicateQuestion: (sectionId: string, questionId: string) => void;
  onReorderQuestions: (sectionId: string, startIndex: number, endIndex: number) => void;
  onLinkQuestionToActivity: (sectionId: string, questionId: string, activityMapping: ActivityKPIMapping) => void;
  onLinkQuestionToActivities: (sectionId: string, questionId: string, activityMappings: ActivityKPIMapping[]) => void;
}

/**
 * Sortable Question Item Component
 * 
 * Wraps question editors with drag-and-drop functionality.
 * Provides a grip handle for reordering questions within a section.
 * 
 * Features:
 * - Visual drag handle with hover effects
 * - Smooth drag animations
 * - Accessibility support with keyboard navigation
 * - Maintains question editor functionality while dragging
 */
interface SortableQuestionItemProps {
  question: FormQuestion;
  sectionId: string;
  children: React.ReactNode;
}

function SortableQuestionItem({ question, sectionId, children }: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute left-0 top-0 h-full flex items-center justify-center w-8 cursor-grab active:cursor-grabbing z-10">
        <div
          {...attributes}
          {...listeners}
          className="p-2 hover:bg-gray-100 rounded transition-colors duration-200 group"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </div>
      </div>
      <div className="ml-8">
        {children}
      </div>
    </div>
  );
}

export function QuestionsStep({
  sections,
  availableActivities,
  isEditing = false,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onDuplicateQuestion,
  onReorderQuestions,
  onLinkQuestionToActivity,
  onLinkQuestionToActivities,
}: QuestionsStepProps) {
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>('SHORT_TEXT');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');
  const [deleteTarget, setDeleteTarget] = useState<{ sectionId: string; questionId: string; title: string } | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentSection = sections.find(s => s.id === selectedSectionId);
      if (!currentSection) return;

      const questions = filterMainQuestions(currentSection.questions);
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderQuestions(selectedSectionId, oldIndex, newIndex);
      }
    }
  };

  // Update selected section when sections change
  useEffect(() => {
    if (sections.length > 0 && (!selectedSectionId || !sections.find(s => s.id === selectedSectionId))) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const totalQuestions = sections.reduce((total, section) => total + section.questions.length, 0);
  const currentSection = sections.find(s => s.id === selectedSectionId);

  const handleDeleteQuestion = (sectionId: string, question: FormQuestion) => {
    if (isEditing) {
      setDeleteTarget({ sectionId, questionId: question.id, title: question.title || 'this question' });
    } else {
      onRemoveQuestion(sectionId, question.id);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      onRemoveQuestion(deleteTarget.sectionId, deleteTarget.questionId);
      setDeleteTarget(null);
    }
  };

  const renderQuestionEditor = (sectionId: string, question: FormQuestion) => {
    const commonProps = {
      question,
      onUpdate: (updates: Partial<FormQuestion>) => onUpdateQuestion(sectionId, question.id, updates),
      onDelete: () => handleDeleteQuestion(sectionId, question),
      onDuplicate: () => onDuplicateQuestion(sectionId, question.id),
      availableActivities,
      onLinkToActivity: (activityMapping: ActivityKPIMapping) => 
        onLinkQuestionToActivity(sectionId, question.id, activityMapping),
      onLinkToActivities: (activityMappings: ActivityKPIMapping[]) => 
        onLinkQuestionToActivities(sectionId, question.id, activityMappings),
      sectionId,
      onAddQuestion: (sid: string, type: QuestionType) => onAddQuestion(sid, type, question.id),
    };

    switch (question.type) {
      case 'SHORT_TEXT':
      case 'EMAIL':
      case 'PHONE':
        return <ShortTextQuestionEditor {...commonProps} question={question as any} />;
      case 'SINGLE_CHOICE':
      case 'YES_NO':
        return <SingleChoiceQuestionEditor {...commonProps} question={question as any} />;
      case 'MULTIPLE_CHOICE':
        return <MultipleChoiceQuestionEditor {...commonProps} question={question} />;
      case 'NUMBER':
        return <NumberQuestionEditor {...commonProps} question={question} />;
      case 'DATE':
      case 'DATETIME':
        return <DateQuestionEditor {...commonProps} question={question} />;
      case 'LIKERT_SCALE':
        return <LikertScaleQuestionEditor {...commonProps} question={question as any} />;
      case 'LOCATION':
        return <LocationQuestionEditor {...commonProps} question={question as any} />;
      case 'IMAGE_UPLOAD':
      case 'VIDEO_UPLOAD':
      case 'AUDIO_UPLOAD':
      case 'FILE_UPLOAD':
        return <MediaUploadQuestionEditor {...commonProps} question={question} />;
      default:
        // For question types we haven't implemented specific editors for yet
        return <BaseQuestionEditor {...commonProps} />;
    }
  };

  const QuestionTypeSelector = ({ sectionId }: { sectionId: string }) => (
    <Card className="mb-6 border-dashed border-2 border-blue-300 bg-blue-50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-center">
            <Plus className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-medium text-blue-900">Add a Question to This Section</h4>
          
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-2">Question Type</label>
              <Select value={selectedQuestionType} onValueChange={(value: QuestionType) => setSelectedQuestionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPE_CATEGORIES).map(([category, types]) => (
                    <React.Fragment key={category}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100">
                        {category}
                      </div>
                      {types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {QUESTION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => {
                  onAddQuestion(sectionId, selectedQuestionType);
                  toast({
                    title: 'Question added',
                    description: `${selectedQuestionType.replace('_', ' ')} added to end of section.`,
                  });
                }}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>
          </div>

         {/*  {selectedQuestionType && (
            <div className="p-3 bg-white rounded border">
              <p className="text-sm font-medium text-gray-900">
                {QUESTION_TYPE_LABELS[selectedQuestionType]}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {QUESTION_TYPE_DESCRIPTIONS[selectedQuestionType]}
              </p>
            </div>
          )} */}
        </div>
      </CardContent>
    </Card>
  );

  if (sections.length === 0) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900">No Sections Available</p>
              <p className="text-sm text-orange-700">
                Please go back to the previous step and create at least one section before adding questions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Form Questions
            </div>
            <Badge variant="outline">
              {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Add questions to each section of your form. You can link questions to project activities 
            to automatically track progress toward your KPIs.
          </p>
        </CardContent>
      </Card>

      {/* Section Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Select Section:</span>
            </div>
            <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section, index) => (
                  <SelectItem key={section.id} value={section.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{section.title || `Section ${index + 1}`}</span>
                      <span className="text-xs text-gray-500">
                        {section.questions.length} question{section.questions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Current Section Content */}
      {currentSection && (
        <div className="space-y-6">
            {/* Section Header */}
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">{currentSection.title}</h3>
                </div>
                {currentSection.description && (
                  <p className="text-sm text-gray-600">{currentSection.description}</p>
                )}
              </CardContent>
            </Card>

            {/* Add Question */}
            <QuestionTypeSelector sectionId={currentSection.id} />

            {/* Reordering Instructions */}
            {currentSection.questions.length > 1 && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <GripVertical className="w-4 h-4" />
                    <span>Drag questions by the grip handle to reorder them</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Questions List */}
            {currentSection.questions.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">No questions in this section yet</p>
                    <p className="text-sm text-gray-500">
                      Use the question selector above to add your first question.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filterMainQuestions(currentSection.questions).map(q => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {filterMainQuestions(currentSection.questions).map((question) => (
                      <SortableQuestionItem
                        key={question.id}
                        question={question}
                        sectionId={currentSection.id}
                      >
                        {renderQuestionEditor(currentSection.id, question)}
                      </SortableQuestionItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
        </div>
      )}

      {/* Question Guidelines */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <h4 className="font-medium text-green-900 mb-2">Question Design Best Practices</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Keep questions clear, concise, and focused on one topic</li>
            <li>• Use simple language that your target audience will understand</li>
            <li>• Avoid leading or biased questions</li>
            <li>• Provide clear instructions for complex question types</li>
            <li>• Link questions to project activities to enable automatic KPI tracking</li>
            <li>• Test your questions with a small group before deploying</li>
          </ul>
        </CardContent>
      </Card>

      {/* Validation Notice */}
      {totalQuestions === 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">Questions Required</p>
                <p className="text-sm text-orange-700">
                  Please add at least one question to your form before proceeding.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete question confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to permanently delete{' '}
                  <span className="font-semibold text-foreground">"{deleteTarget?.title}"</span>.
                </p>
                <p className="text-red-600 font-medium">
                  All response data collected for this question will also be permanently deleted.
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete question &amp; data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
 
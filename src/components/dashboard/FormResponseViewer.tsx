import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { 
  ArrowLeft,
  Download,
  Filter,
  Search,
  Calendar,
  BarChart3,
  PieChart,
  Users,
  Clock,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  File,
  Image,
  Video,
  Music,
  Paperclip
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Form, FormResponse, FormQuestion, MediaAttachment } from './form-creation-wizard/types';
import { useForm } from '@/contexts/FormContext';
import { formsApi } from '@/lib/api/formsApi';
import { ResponseEditModal } from './ResponseEditModal';
import { useAuth } from '@/contexts/AuthContext';
import { createEnhancedPermissionManager } from '@/lib/permissions';

// Helper function to transform backend question format to frontend format
const transformQuestionData = (question: any) => {
  if (!question.config) return question;
  
  // Extract options from config if they exist
  const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;
  
  return {
    ...question,
    options: config.options || [],
    // Extract other config properties that might be expected at top level
    placeholder: config.placeholder,
    min: config.min,
    max: config.max,
    step: config.step,
    allowOther: config.allowOther,
    maxSelections: config.maxSelections,
    displayType: config.displayType,
    statements: config.statements,
    defaultScaleType: config.defaultScaleType,
    defaultLabels: config.defaultLabels,
    // Preserve the original config
    config
  };
};

// Helper function to get all questions (main + conditional) in the correct order
// For repeatable sections, includes instance columns
const getAllQuestionsInOrder = (
  form: Form,
  maxInstances?: number
): Array<{
  question: FormQuestion;
  isConditional: boolean;
  parentQuestion?: FormQuestion;
  parentOption?: any;
  isRepeatable?: boolean;
  sectionId?: string;
  instanceIndex?: number;
  instanceKey?: string; // For repeatable: questionId_instance_N
}> => {
  const allQuestions: Array<{
    question: FormQuestion;
    isConditional: boolean;
    parentQuestion?: FormQuestion;
    parentOption?: any;
    isRepeatable?: boolean;
    sectionId?: string;
    instanceIndex?: number;
    instanceKey?: string;
  }> = [];

  // Get repeatable sections
  const repeatableSections = getRepeatableSections(form);
  const repeatableSectionIds = new Set(repeatableSections.map(s => s.id));

  form.sections.forEach(section => {
    const isRepeatable = repeatableSectionIds.has(section.id);
    
    section.questions.forEach(question => {
      if (isRepeatable && maxInstances) {
        // For repeatable sections, create columns for each instance
        for (let instanceIndex = 0; instanceIndex < maxInstances; instanceIndex++) {
      allQuestions.push({
        question,
            isConditional: false,
            isRepeatable: true,
            sectionId: section.id,
            instanceIndex,
            instanceKey: `${question.id}_instance_${instanceIndex}`
          });

          // Add conditional questions for each instance
          if ((question as any).options && Array.isArray((question as any).options)) {
            (question as any).options.forEach((option: any) => {
              if (option.conditionalQuestions && Array.isArray(option.conditionalQuestions)) {
                option.conditionalQuestions.forEach((condQuestion: any) => {
                  allQuestions.push({
                    question: condQuestion as FormQuestion,
                    isConditional: true,
                    parentQuestion: question,
                    parentOption: option,
                    isRepeatable: true,
                    sectionId: section.id,
                    instanceIndex,
                    instanceKey: `${condQuestion.id}_instance_${instanceIndex}`
                  });
                });
              }
            });
          }
        }
      } else {
        // Non-repeatable section - add question once
        allQuestions.push({
          question,
          isConditional: false,
          isRepeatable: false,
          sectionId: section.id
      });

      // Add conditional questions
      if ((question as any).options && Array.isArray((question as any).options)) {
        (question as any).options.forEach((option: any) => {
          if (option.conditionalQuestions && Array.isArray(option.conditionalQuestions)) {
            option.conditionalQuestions.forEach((condQuestion: any) => {
              allQuestions.push({
                question: condQuestion as FormQuestion,
                isConditional: true,
                parentQuestion: question,
                  parentOption: option,
                  isRepeatable: false,
                  sectionId: section.id
              });
            });
          }
        });
        }
      }
    });
  });

  return allQuestions;
};

// Helper function to transform form data structure
const transformFormData = (form: any): Form => {
  if (!form) return form;
  
  return {
    ...form,
    sections: form.sections?.map((section: any) => ({
      ...section,
      questions: section.questions?.map(transformQuestionData) || []
    })) || []
  };
};

// Helper function to parse repeatable section metadata from source field
const parseRepeatableMetadata = (source: string | null | undefined): {
  isRepeatable: boolean;
  repeatableSectionId?: string;
  instanceIndex?: number;
  originalSource?: string;
} => {
  if (!source || !source.startsWith('{')) {
    return { isRepeatable: false };
  }
  
  try {
    const parsed = JSON.parse(source);
    if (parsed.type === 'repeatable') {
      return {
        isRepeatable: true,
        repeatableSectionId: parsed.repeatableSectionId,
        instanceIndex: parsed.instanceIndex,
        originalSource: parsed.originalSource
      };
    }
  } catch (e) {
    // Not JSON, treat as regular source
  }
  
  return { isRepeatable: false };
};

// Time window (ms) to group repeat-section responses that have no submission id (proximity grouping)
const PROXIMITY_GROUP_WINDOW_MS = 2  * 1000; // 2 minutes

// Helper function to group responses by submission (for repeatable sections)
// 1) Responses with explicit submission id (originalSource) are grouped by that.
// 2) Repeat-section responses without submission id are grouped by proximity (same respondent, startedAt within window).
const groupResponsesBySubmission = (responses: FormResponse[], form?: Form): Map<string, FormResponse[]> => {
  const groups = new Map<string, FormResponse[]>();
  const hasRepeatableSections = form ? getRepeatableSections(form).length > 0 : false;

  console.log('🔍 Grouping responses:', {
    responseCount: responses.length,
    hasRepeatableSections,
    formHasSections: !!form
  });

  // First pass: separate responses with explicit repeatable metadata from those without
  const withMetadata: FormResponse[] = [];
  const withoutSubmissionId: FormResponse[] = [];
  responses.forEach(response => {
    const metadata = parseRepeatableMetadata(response.source);
    if (metadata.isRepeatable && metadata.originalSource) {
      withMetadata.push(response);
    } else {
      withoutSubmissionId.push(response);
    }
  });

  // Group metadata-tagged responses by proximity chaining (same respondent, within window).
  // This replaces the old per-second rounding which split households whose instances
  // spanned more than one second into separate groups.
  if (withMetadata.length > 0) {
    const sorted = [...withMetadata].sort((a, b) => {
      const emailA = a.respondentEmail ?? 'anonymous';
      const emailB = b.respondentEmail ?? 'anonymous';
      if (emailA !== emailB) return emailA.localeCompare(emailB);
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeA - timeB;
    });

    let currentGroup: FormResponse[] = [];
    let currentRespondent: string | undefined;
    let currentWindowEnd = 0;

    const flushMetadataGroup = () => {
      if (currentGroup.length === 0) return;
      const first = currentGroup[0];
      const meta = parseRepeatableMetadata(first.source);
      const respondent = first.respondentEmail ?? 'anonymous';
      const key = `meta_${meta.originalSource}_${respondent}_${first.startedAt ? new Date(first.startedAt).getTime() : first.id}`;
      groups.set(key, [...currentGroup]);
    };

    sorted.forEach(response => {
      const respondent = response.respondentEmail ?? 'anonymous';
      const startedAt = response.startedAt ? new Date(response.startedAt).getTime() : 0;

      const sameRespondent = currentRespondent === respondent;
      const withinWindow = currentGroup.length > 0 && startedAt <= currentWindowEnd;

      if (currentGroup.length > 0 && sameRespondent && withinWindow) {
        currentGroup.push(response);
        currentWindowEnd = startedAt + PROXIMITY_GROUP_WINDOW_MS;
      } else {
        flushMetadataGroup();
        currentGroup = [response];
        currentRespondent = respondent;
        currentWindowEnd = startedAt + PROXIMITY_GROUP_WINDOW_MS;
      }
    });
    flushMetadataGroup();
  }

  // Second pass: for forms with repeatable sections, group remaining responses by proximity (same respondent, close startedAt)
  if (hasRepeatableSections && withoutSubmissionId.length > 0) {
    const repeatableQIds = new Set(
      getRepeatableSections(form!).flatMap(s => s.questions.map(q => q.id))
    );

    // "New-format" responses already embed all repeat instances as { "0": v, "1": v, … }.
    // These are self-contained and must NOT be proximity-grouped with other responses.
    const isNewFormatResponse = (r: FormResponse): boolean => {
      for (const qId of repeatableQIds) {
        const val = r.data[qId];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const keys = Object.keys(val);
          if (keys.some(k => /^\d+$/.test(k))) return true;
        }
      }
      return false;
    };

    // Separate new-format responses (each is its own group) from old-format
    const oldFormatResponses: FormResponse[] = [];
    withoutSubmissionId.forEach(response => {
      if (isNewFormatResponse(response)) {
        groups.set(`single_${response.id}`, [response]);
      } else {
        oldFormatResponses.push(response);
      }
    });

    const sorted = [...oldFormatResponses].sort((a, b) => {
      const emailA = a.respondentEmail ?? 'anonymous';
      const emailB = b.respondentEmail ?? 'anonymous';
      if (emailA !== emailB) return emailA.localeCompare(emailB);
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeA - timeB;
    });

    let currentGroup: FormResponse[] = [];
    let currentRespondent: string | undefined;
    let currentWindowEnd = 0;

    sorted.forEach(response => {
      const respondent = response.respondentEmail ?? 'anonymous';
      const startedAt = response.startedAt ? new Date(response.startedAt).getTime() : 0;

      const sameRespondent = currentRespondent === respondent;
      const withinWindow = currentGroup.length > 0 && startedAt <= currentWindowEnd;

      if (currentGroup.length > 0 && sameRespondent && withinWindow) {
        currentGroup.push(response);
        currentWindowEnd = startedAt + PROXIMITY_GROUP_WINDOW_MS;
      } else {
        if (currentGroup.length === 1) {
          groups.set(`single_${currentGroup[0].id}`, currentGroup);
        } else if (currentGroup.length > 1) {
          const first = currentGroup[0];
          const groupRespondent = first.respondentEmail ?? 'anonymous';
          const key = `proximity_${groupRespondent}_${first.startedAt ? new Date(first.startedAt).getTime() : first.id}`;
          groups.set(key, [...currentGroup]);
        }
        currentGroup = [response];
        currentRespondent = respondent;
        currentWindowEnd = startedAt + PROXIMITY_GROUP_WINDOW_MS;
      }
    });

    if (currentGroup.length === 1) {
      groups.set(`single_${currentGroup[0].id}`, currentGroup);
    } else if (currentGroup.length > 1) {
      const first = currentGroup[0];
      const groupRespondent = first.respondentEmail ?? 'anonymous';
      const key = `proximity_${groupRespondent}_${first.startedAt ? new Date(first.startedAt).getTime() : first.id}`;
      groups.set(key, currentGroup);
    }
  } else {
    withoutSubmissionId.forEach(response => {
      groups.set(`single_${response.id}`, [response]);
      console.log('📝 Single response group:', { responseId: response.id });
    });
  }

  // Sort responses within each group by instanceIndex or startedAt
  groups.forEach((groupResponses, key) => {
    if (key.startsWith('single_')) return;
    groupResponses.sort((a, b) => {
      const metaA = parseRepeatableMetadata(a.source);
      const metaB = parseRepeatableMetadata(b.source);
      if (metaA.instanceIndex !== undefined && metaB.instanceIndex !== undefined) {
        return metaA.instanceIndex - metaB.instanceIndex;
      }
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeA - timeB;
    });
  });

  console.log('📊 Final groups:', {
    totalGroups: groups.size,
    groupSummary: Array.from(groups.entries()).map(([key, res]) => ({
      groupKey: key,
      responseCount: res.length,
      emails: [...new Set(res.map(r => r.respondentEmail || 'anonymous'))],
      timeSpan: res.length > 1 ? { first: res[0].startedAt, last: res[res.length - 1].startedAt } : 'single'
    }))
  });

  return groups;
};

// Helper function to get repeatable sections from form
const getRepeatableSections = (form: Form): Array<{ id: string; title: string; questions: FormQuestion[] }> => {
  const repeatableSections = form.sections
    .filter(section => (section as any).conditional?.repeatable)
    .map(section => ({
      id: section.id,
      title: section.title,
      questions: section.questions
    }));
    
  return repeatableSections;
};

// Helper function to flatten grouped responses for display/export
// Transforms multiple rows (one per instance) into one row with instance columns
interface FlattenedResponse {
  id: string;
  respondentEmail?: string;
  isComplete: boolean;
  submittedAt: Date | null;
  startedAt: Date | null;
  data: Record<string, any>; // Flattened data with instance columns
  attachments: MediaAttachment[];
  originalResponses: FormResponse[]; // Keep reference to original responses
}

const flattenGroupedResponses = (
  groupedResponses: FormResponse[],
  form: Form
): FlattenedResponse | null => {
  if (groupedResponses.length === 0) return null;
  
  const firstResponse = groupedResponses[0];
  const metadata = parseRepeatableMetadata(firstResponse.source);
  
  // Get repeatable sections
  const repeatableSections = getRepeatableSections(form);
  const repeatableQuestionIds = new Set(
    repeatableSections.flatMap(s => s.questions.map(q => q.id))
  );

  // Helper: expand repeatable values into instance keys so viewer/export see one value per column.
  // Handles both new-format objects { "0": v0, "1": v1 } and old-format scalars (assigned to instance 0).
  const expandRepeatableData = (data: Record<string, any>): Record<string, any> => {
    const out = { ...data };
    for (const [questionId, value] of Object.entries(data)) {
      if (!repeatableQuestionIds.has(questionId)) continue;
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        const numericKeys = keys.filter(k => /^\d+$/.test(k));
        if (numericKeys.length > 0) {
          numericKeys.forEach(indexStr => {
            out[`${questionId}_instance_${indexStr}`] = value[indexStr];
          });
          continue;
        }
      }

      // Scalar value (string, number, boolean, array) for a repeatable question → instance 0
      if (out[`${questionId}_instance_0`] === undefined) {
        out[`${questionId}_instance_0`] = value;
      }
    }
    return out;
  };

  // If single response and not repeatable metadata, return data with repeatable values expanded into instance keys
  if (groupedResponses.length === 1 && !metadata.isRepeatable) {
    const data = expandRepeatableData(firstResponse.data);
    return {
      id: firstResponse.id,
      respondentEmail: firstResponse.respondentEmail,
      isComplete: firstResponse.isComplete,
      submittedAt: firstResponse.submittedAt || null,
      startedAt: firstResponse.startedAt || null,
      data,
      attachments: firstResponse.attachments || [],
      originalResponses: [firstResponse]
    };
  }
  
  // Multiple responses = treat as repeatable instances (even without metadata)
  // Try to find the repeatable section from metadata first
  let repeatableSection = metadata.isRepeatable && metadata.repeatableSectionId
    ? repeatableSections.find(s => s.id === metadata.repeatableSectionId)
    : null;
  
  // If no metadata but we have multiple responses and repeatable sections exist,
  // assume they're from the first repeatable section
  if (!repeatableSection && groupedResponses.length > 1 && repeatableSections.length > 0) {
    repeatableSection = repeatableSections[0];
    console.log('🔍 No metadata found, assuming first repeatable section:', repeatableSection.id);
  }
  
  if (!repeatableSection) {
    // No repeatable section found - merge all responses into one
    const mergedData: Record<string, any> = {};
    const allAttachments: MediaAttachment[] = [];
    
    groupedResponses.forEach((response, index) => {
      Object.assign(mergedData, response.data);
      if (response.attachments) {
        allAttachments.push(...response.attachments);
      }
    });
    
    return {
      id: firstResponse.id,
      respondentEmail: firstResponse.respondentEmail,
      isComplete: groupedResponses.every(r => r.isComplete),
      submittedAt: firstResponse.submittedAt || null,
      startedAt: firstResponse.startedAt || null,
      data: mergedData,
      attachments: allAttachments,
      originalResponses: groupedResponses // Preserve all original responses
    };
  }
  
  // Merge data from all instances
  const flattenedData: Record<string, any> = {};
  const allAttachments: MediaAttachment[] = [];
  
  // First, get non-repeatable section data (should be same across all instances)
  const nonRepeatableSections = form.sections.filter(
    section => !(section as any).conditional?.repeatable
  );
  
  nonRepeatableSections.forEach(section => {
    section.questions.forEach(question => {
      // Use data from first response (should be same across all)
      if (firstResponse.data[question.id] !== undefined) {
        flattenedData[question.id] = firstResponse.data[question.id];
      }
    });
  });
  
  // Then, add repeatable section data with instance suffixes.
  // A response can be either old-format (scalar values, one response per instance) or
  // new-format (object values like {"0": v, "1": v} containing all instances).
  groupedResponses.forEach((response, index) => {
    const responseMetadata = parseRepeatableMetadata(response.source);
    const instanceIndex = responseMetadata.instanceIndex !== undefined ? responseMetadata.instanceIndex : index;
    
    repeatableSection.questions.forEach(question => {
      const val = response.data[question.id];
      if (val === undefined) return;

      // New-format: value is an object with numeric keys — expand each into its own instance key
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const numericKeys = Object.keys(val).filter(k => /^\d+$/.test(k));
        if (numericKeys.length > 0) {
          numericKeys.forEach(k => {
            flattenedData[`${question.id}_instance_${k}`] = val[k];
          });
          return;
        }
      }

      // Old-format: scalar value — one instance per response
      flattenedData[`${question.id}_instance_${instanceIndex}`] = val;
    });
    
    if (response.attachments) {
      allAttachments.push(...response.attachments);
    }
  });
  
  console.log('✅ Flattened grouped responses:', {
    groupSize: groupedResponses.length,
    flattenedDataKeys: Object.keys(flattenedData),
    instanceKeys: Object.keys(flattenedData).filter(k => k.includes('_instance_')),
    originalResponseCount: groupedResponses.length
  });
  
  return {
    id: firstResponse.id, // Use first response ID as primary
    respondentEmail: firstResponse.respondentEmail,
    isComplete: groupedResponses.every(r => r.isComplete), // All must be complete
    submittedAt: firstResponse.submittedAt || null, // Use first submission time
    startedAt: firstResponse.startedAt || null, // Use first start time
    data: flattenedData,
    attachments: allAttachments,
    originalResponses: groupedResponses // Preserve ALL original responses
  };
};

// ResponseCell component for displaying different types of response data
interface ResponseCellProps {
  question: FormQuestion;
  value: any;
  attachments: MediaAttachment[];
  isEditable?: boolean;
  onValueChange?: (value: any) => void;
  responseData?: Record<string, any>; // Full response data for conditional questions
}

function ResponseCell({ question, value, attachments, isEditable = false, onValueChange, responseData }: ResponseCellProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  };

  // Handle different question types
  switch (question.type) {
    case 'SHORT_TEXT':
      if (isEditable) {
        return (
          <Input
            value={value || ''}
            onChange={(e) => onValueChange?.(e.target.value)}
            className="text-xs h-6 px-1"
            placeholder="Enter value..."
          />
        );
      }
      return (
        <div className="text-xs max-w-[200px] truncate leading-tight" title={value}>
          {value || '-'}
        </div>
      );

    case 'EMAIL':
      if (isEditable) {
        return (
          <Input
            type="email"
            value={value || ''}
            onChange={(e) => onValueChange?.(e.target.value)}
            className="text-xs h-6 px-1"
            placeholder="Enter email..."
          />
        );
      }
      return (
        <div className="text-xs max-w-[200px] truncate leading-tight" title={value}>
          {value ? (
            <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 underline">
              {value}
            </a>
          ) : '-'}
        </div>
      );

    case 'PHONE':
      if (isEditable) {
        return (
          <Input
            type="tel"
            value={value || ''}
            onChange={(e) => onValueChange?.(e.target.value)}
            className="text-xs h-6 px-1"
            placeholder="Enter phone..."
          />
        );
      }
      return (
        <div className="text-xs max-w-[200px] truncate leading-tight" title={value}>
          {value ? (
            <a href={`tel:${value}`} className="text-blue-600 hover:text-blue-800 underline">
              {value}
            </a>
          ) : '-'}
        </div>
      );

    case 'NUMBER': {
      const numQuestion = question as { min?: number; max?: number };
      if (isEditable) {
        const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          if (raw === '') {
            onValueChange?.(null);
            return;
          }
          let num = Number(raw);
          if (isNaN(num)) return;
          if (numQuestion.min != null && num < numQuestion.min) num = numQuestion.min;
          if (numQuestion.max != null && num > numQuestion.max) num = numQuestion.max;
          onValueChange?.(num);
        };
        return (
          <Input
            type="number"
            value={value ?? ''}
            onChange={handleNumberChange}
            min={numQuestion.min}
            max={numQuestion.max}
            className="text-xs h-6 px-1 font-mono"
            placeholder="Enter number..."
          />
        );
      }
      return (
        <div className="text-xs font-mono leading-tight">
          {value !== undefined && value !== null ? value : '-'}
        </div>
      );
    }

    case 'SINGLE_CHOICE':
      if (isEditable) {
        return (
          <Select value={value || ''} onValueChange={onValueChange}>
            <SelectTrigger className="text-xs h-6 px-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.id} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      
      const selectedOption = question.options?.find(opt => opt.value.toString() === value?.toString());
      const selectedLabel = selectedOption?.label || value || '-';
      
      // Check if this option has conditional questions and if there are responses for them
      const conditionalResponses = selectedOption?.hasConditionalQuestions && selectedOption?.conditionalQuestions && responseData ? 
        selectedOption.conditionalQuestions.map(conditionalQuestion => {
          const conditionalValue = responseData[conditionalQuestion.id];
          return {
            question: conditionalQuestion,
            value: conditionalValue
          };
        }).filter(item => item.value !== undefined) : [];
      
      return (
        <div className="text-xs leading-tight space-y-1">
          <div className="font-medium">{selectedLabel}</div>
          {conditionalResponses.length > 0 && (
            <div className="ml-2 pl-2 border-l-2 border-blue-200 space-y-1">
              {conditionalResponses.map(({ question: conditionalQuestion, value: conditionalValue }) => (
                <div key={conditionalQuestion.id} className="text-gray-600">
                  <span className="font-medium">{conditionalQuestion.title}:</span>{' '}
                  <span>{conditionalValue || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'MULTIPLE_CHOICE':
      if (Array.isArray(value) && question.options) {
        const selectedLabels = value
          .map(v => question.options?.find(opt => opt.value === v)?.label || v)
          .join(', ');
        
        // Check for conditional questions
        const conditionalResponses = question.options
          .filter(option => 
            option.hasConditionalQuestions && 
            option.conditionalQuestions && 
            value.includes(option.value.toString())
          )
          .flatMap(option => 
            option.conditionalQuestions!.map(conditionalQuestion => {
              const conditionalValue = responseData?.[conditionalQuestion.id];
              return { question: conditionalQuestion, value: conditionalValue };
            }).filter(item => item.value !== undefined)
          );
        
        return (
          <div className="text-xs leading-tight space-y-1">
            <div className="font-medium">{selectedLabels || '-'}</div>
            {conditionalResponses.length > 0 && (
              <div className="ml-2 pl-2 border-l-2 border-blue-200 space-y-1">
                {conditionalResponses.map(({ question: conditionalQuestion, value: conditionalValue }) => (
                  <div key={conditionalQuestion.id} className="text-gray-600">
                    <span className="font-medium">{conditionalQuestion.title}:</span>{' '}
                    <span>{conditionalValue || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      return <div className="text-xs leading-tight">{Array.isArray(value) ? value.join(', ') : value || '-'}</div>;

    case 'DATE':
    case 'DATETIME':
      return (
        <div className="text-xs leading-tight">
          {value ? new Date(value).toLocaleDateString() : '-'}
        </div>
      );

    case 'SLIDER':
      return (
        <div className="text-xs font-mono leading-tight">
          {value !== undefined && value !== null ? value : '-'}
        </div>
      );

    case 'LOCATION':
      if (!value) {
        return <div className="text-xs text-gray-400 leading-tight">No location captured</div>;
      }
      
      const formatCoordinates = (lat: number, lng: number) => {
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
      };
      
      return (
        <div className="text-xs leading-tight space-y-1">
          <div className="font-medium">📍 {formatCoordinates(value.latitude, value.longitude)}</div>
          {value.accuracy && (
            <div className="text-gray-600">Accuracy: {value.accuracy}m</div>
          )}
          {value.address && (
            <div className="text-gray-600 truncate" title={value.address}>
              {value.address}
            </div>
          )}
          <div className="text-gray-500 text-xs">
            {new Date(value.timestamp).toLocaleString()}
          </div>
        </div>
      );

    case 'LIKERT_SCALE':
      if (!value || typeof value !== 'object') {
        return <div className="text-xs text-gray-400 leading-tight">No responses</div>;
      }
      
      // Handle new Likert scale structure with per-statement responses
      const responses = Object.entries(value).map(([statementId, scaleValue]) => {
        // Check if question has statements (new structure) or is old structure
        if (!question.statements || question.statements.length === 0) {
          // Handle old Likert scale structure
          return {
            statementId,
            statement: `Statement ${statementId}`,
            response: String(scaleValue),
            scaleType: '5_POINT' as const // Default for old structure
          };
        }
        
        const statement = question.statements.find(s => s.id === statementId);
        if (!statement) return null;
        
        // Get scale options for this statement
        const getScaleOptions = (scaleType: '3_POINT' | '5_POINT' | '7_POINT', customLabels?: any) => {
          switch (scaleType) {
            case '3_POINT':
              return [
                { value: '1', label: customLabels?.negative || question.defaultLabels?.negative || 'Disagree' },
                { value: '2', label: customLabels?.neutral || question.defaultLabels?.neutral || 'Neutral' },
                { value: '3', label: customLabels?.positive || question.defaultLabels?.positive || 'Agree' }
              ];
            case '5_POINT':
              return [
                { value: '1', label: 'Strongly disagree' },
                { value: '2', label: 'Disagree' },
                { value: '3', label: 'Neither agree nor disagree' },
                { value: '4', label: 'Agree' },
                { value: '5', label: 'Strongly agree' }
              ];
            case '7_POINT':
              return [
                { value: '1', label: 'Strongly disagree' },
                { value: '2', label: 'Disagree' },
                { value: '3', label: 'Somewhat disagree' },
                { value: '4', label: 'Neither agree nor disagree' },
                { value: '5', label: 'Somewhat agree' },
                { value: '6', label: 'Agree' },
                { value: '7', label: 'Strongly agree' }
              ];
            default:
              return [
                { value: '1', label: 'Strongly disagree' },
                { value: '2', label: 'Disagree' },
                { value: '3', label: 'Neither agree nor disagree' },
                { value: '4', label: 'Agree' },
                { value: '5', label: 'Strongly agree' }
              ];
          }
        };
        
        const scaleOptions = getScaleOptions(statement.scaleType, statement.customLabels);
        const selectedOption = scaleOptions.find(opt => opt.value === scaleValue);
        
        return {
          statementId,
          statement: statement.text,
          response: selectedOption ? `${selectedOption.value} (${selectedOption.label})` : String(scaleValue),
          scaleType: statement.scaleType,
          scaleOptions
        };
      }).filter((response): response is NonNullable<typeof response> => response !== null);
      
      if (responses.length === 0) {
        return <div className="text-xs text-gray-400 leading-tight">No responses</div>;
      }
      
      if (isEditable) {
        return (
          <div className="space-y-2">
            {responses.map((response, index) => (
              <div key={index} className="space-y-1">
                <div className="text-xs font-medium text-gray-700">{response.statement}</div>
                <Select
                  value={String(value[response.statementId] || '')}
                  onValueChange={(newValue) => {
                    if (onValueChange) {
                      const newResponses = { ...value, [response.statementId]: newValue };
                      onValueChange(newResponses);
                    }
                  }}
                >
                  <SelectTrigger className="h-6 text-xs">
                    <SelectValue placeholder="Select response..." />
                  </SelectTrigger>
                  <SelectContent>
                    {response.scaleOptions?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value} - {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-gray-400 text-[10px]">{response.scaleType.replace('_', '-')} scale</div>
              </div>
            ))}
          </div>
        );
      }
      
      return (
        <div className="space-y-1">
          {responses.map((response, index) => (
            <div key={index} className="text-xs leading-tight">
              <div className="font-medium text-gray-700">{response.statement}</div>
              <div className="text-gray-600">{response.response}</div>
              <div className="text-gray-400 text-[10px]">{response.scaleType.replace('_', '-')} scale</div>
            </div>
          ))}
        </div>
      );

    case 'IMAGE_UPLOAD':
    case 'VIDEO_UPLOAD':
    case 'AUDIO_UPLOAD':
    case 'FILE_UPLOAD':
      // Handle both attachments (from database) and direct file data (from responses)
      const mediaFiles = attachments.length > 0 ? attachments : (Array.isArray(value) ? value : []);
      
      if (mediaFiles.length > 0) {
        return (
          <div className="space-y-1">
            {mediaFiles.map((fileData, index) => {
              // Check if this is a link
              const isLink = fileData.type === 'link' || (fileData.url && !fileData.fileName && !fileData.name);
              
              if (isLink) {
                // Render link
                const linkUrl = fileData.url || fileData;
                const linkLabel = fileData.label || linkUrl;
                
                return (
                  <div key={index} className="flex items-center gap-1 text-xs">
                    <span>🔗</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate leading-tight font-medium text-blue-600" title={linkLabel}>
                        {linkLabel}
                      </div>
                      <div className="text-gray-500 text-[10px] leading-tight">
                        <a 
                          href={linkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline truncate block"
                          title={linkUrl}
                        >
                          {linkUrl}
                        </a>
                        <Badge variant="outline" className="text-[9px] mt-0.5">Link</Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => {
                        window.open(linkUrl, '_blank', 'noopener,noreferrer');
                      }}
                      title="Open link"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                );
              }
              
              // Handle both attachment objects and file data objects
              const fileName = fileData.fileName || fileData.name || fileData.originalName || 'Unknown file';
              const fileSize = fileData.fileSize || fileData.size || 0;
              const fileUrl = fileData.url;
              const mimeType = fileData.mimeType || fileData.type || '';
              const fileId = fileData.id || index;
              
              return (
                <div key={fileId} className="flex items-center gap-1 text-xs">
                  <span>{getMediaIcon(mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate leading-tight" title={fileName}>
                      {fileName}
                    </div>
                    <div className="text-gray-500 text-[10px] leading-tight">
                      {formatFileSize(fileSize)}
                      {fileUrl && (
                        <>
                          <br />
                          <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                            title={fileUrl}
                          >
                            {fileUrl}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {fileUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = fileUrl;
                        link.download = fileName;
                        link.click();
                      }}
                      title="Download file"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
      return <div className="text-xs text-gray-400 leading-tight">No files or links</div>;

    default:
      // Avoid "[object Object]" when value is an object (e.g. nested or unknown type from backend)
      const displayValue = value !== undefined && value !== null
        ? (typeof value === 'object' && value !== null && !Array.isArray(value)
            ? JSON.stringify(value)
            : String(value))
        : '-';
      return (
        <div className="text-xs max-w-[200px] truncate leading-tight" title={displayValue}>
          {displayValue}
        </div>
      );
  }
}



export function FormResponseViewer() {
  const { formId, projectId } = useParams();
  const navigate = useNavigate();
  const { getFormResponses, deleteFormResponse, getProjectForms, loadProjectForms, addFormResponseToStorage } = useForm();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const permissionManager = createEnhancedPermissionManager({ user, isAuthenticated, isLoading: authLoading });
  const canEdit = projectId ? permissionManager.canEditFormResponses(projectId) : false;
  const canDelete = projectId ? permissionManager.canDeleteFormResponses(projectId) : false;
  const canExport = projectId ? permissionManager.canExportFormResponses(projectId) : false;
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FlattenedResponse[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [responseStats, setResponseStats] = useState({ totalAll: 0, totalComplete: 0, totalIncomplete: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; questionId: string } | null>(null);
  const [manualData, setManualData] = useState<Record<number, Record<string, any>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  // Debounce search term for API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load form data (once on mount)
  useEffect(() => {
    const loadFormData = async () => {
      if (formId && projectId) {
        try {
          console.log('🔄 FormResponseViewer: Loading form data for:', formId);
          const completeForm = await formsApi.getForm(projectId, formId);
          if (completeForm) {
            const transformedForm = transformFormData(completeForm);
            setForm(transformedForm);
            console.log('📋 FormResponseViewer: Loaded form with', transformedForm.sections?.length || 0, 'sections');
          } else {
            console.log('⚠️ FormResponseViewer: Complete form not found, trying project forms list');
            const projectForms = await loadProjectForms(projectId);
            const foundForm = projectForms.find((f: Form) => f.id === formId);
            if (foundForm) {
              const transformedFallbackForm = transformFormData(foundForm);
              setForm(transformedFallbackForm);
              console.log('📦 FormResponseViewer: Found form in project list:', foundForm.title);
            }
          }
        } catch (error) {
          console.error('❌ FormResponseViewer: Error loading form data:', error);
          toast({
            title: "Error",
            description: "Failed to load form data",
            variant: "destructive",
          });
        }
      }
    };

    loadFormData();
  }, [formId, projectId]);

  // Load responses with server-side pagination
  useEffect(() => {
    const loadResponses = async () => {
      if (formId && projectId && form) {
        setIsLoading(true);
        try {
          console.log('🔄 FormResponseViewer: Loading responses page', currentPage, 'with', itemsPerPage, 'items');
          const result = await getFormResponses(projectId, formId, {
            page: currentPage,
            limit: itemsPerPage,
            search: debouncedSearchTerm || undefined,
            status: statusFilter as 'all' | 'complete' | 'incomplete'
          });
          
          // Group and flatten responses for display
          const repeatableSections = getRepeatableSections(form);
          console.log('🔍 Repeatable sections found:', repeatableSections.map(s => ({ id: s.id, title: s.title })));
          
          const grouped = groupResponsesBySubmission(result.responses, form);
          console.log('🔍 Grouped responses:', {
            totalRawResponses: result.responses.length,
            groupCount: grouped.size,
            groups: Array.from(grouped.entries()).map(([key, responses]) => ({
              groupKey: key,
              responseCount: responses.length,
              firstResponseSource: responses[0]?.source,
              responseIds: responses.map(r => r.id)
            }))
          });
          
          // Flatten each group of responses
          const flattened: FlattenedResponse[] = [];
          grouped.forEach((groupResponses, groupKey) => {
            console.log(`🔍 Processing group ${groupKey} with ${groupResponses.length} responses`);
            const flattenedResponse = flattenGroupedResponses(groupResponses, form);
            if (flattenedResponse) {
              console.log(`✅ Flattened response created:`, {
                id: flattenedResponse.id,
                dataKeys: Object.keys(flattenedResponse.data),
                originalResponseCount: flattenedResponse.originalResponses.length
              });
              flattened.push(flattenedResponse);
            } else {
              console.log('❌ Failed to create flattened response for group', groupKey);
            }
          });

          setResponses(flattened); // Set flattened responses for display
          setTotalResponses(result.total);
          setServerTotalPages(result.totalPages);
          setResponseStats(result.stats);
          console.log('✅ FormResponseViewer: Loaded', flattened.length, 'flattened responses (total raw:', result.total, ', stats:', result.stats, ')');
        } catch (error) {
          console.error('❌ FormResponseViewer: Error loading responses:', error);
          toast({
            title: "Error",
            description: "Failed to load form responses",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    // Only load responses if form data is available
    if (form) {
      loadResponses();
    }
  }, [formId, projectId, currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, form]); // form is a dependency now

  // Server-side pagination - responses are already filtered and paginated
  const filteredResponses = responses;
  const totalPages = serverTotalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalResponses);
  
  // Memoize repeatable sections calculation (only recalculate when form changes)
  const repeatableSections = useMemo(() => {
    return form ? getRepeatableSections(form) : [];
  }, [form]);
  
  // Memoize max instances calculation (only recalculate when form or responses change)
  const { overallMaxInstances, maxInstancesBySection } = useMemo(() => {
    const maxInstancesBySectionMap = new Map<string, number>();
    
    if (form && responses.length > 0) {
      repeatableSections.forEach(section => {
        let maxInstances = 0;
        responses.forEach((response) => {
          if (response.originalResponses && response.originalResponses.length > 1) {
            // Multiple original responses = multiple instances
            const hasExplicitMetadata = response.originalResponses.some(orig => {
              const metadata = parseRepeatableMetadata(orig.source);
              return metadata.isRepeatable && metadata.repeatableSectionId === section.id;
            });
            
            if (hasExplicitMetadata) {
              maxInstances = Math.max(maxInstances, response.originalResponses.length);
            } else if (repeatableSections.length === 1) {
              maxInstances = Math.max(maxInstances, response.originalResponses.length);
            } else {
              const hasDataForThisSection = response.originalResponses.some(orig => {
                return section.questions.some(q => orig.data[q.id] !== undefined);
              });
              if (hasDataForThisSection) {
                maxInstances = Math.max(maxInstances, response.originalResponses.length);
              }
            }
          }

          // Also detect instance count from single-response object values (new format: { "0": v, "1": v, ... })
          section.questions.forEach(q => {
            const val = response.data[q.id];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const numericKeys = Object.keys(val).filter(k => /^\d+$/.test(k));
              if (numericKeys.length > 1) {
                maxInstances = Math.max(maxInstances, numericKeys.length);
              }
            }
          });
        });
        maxInstancesBySectionMap.set(section.id, maxInstances || 1);
  });
    }
    
    const overallMax = form ? Math.max(...Array.from(maxInstancesBySectionMap.values()), 1) : 1;
    
    console.log('📊 Calculated max instances (memoized):', {
      overallMax,
      bySection: Object.fromEntries(maxInstancesBySectionMap),
      responseCount: responses.length,
      responsesWithMultipleOriginals: responses.filter(r => r.originalResponses?.length > 1).length
    });
    
    return {
      overallMaxInstances: overallMax,
      maxInstancesBySection: maxInstancesBySectionMap
    };
  }, [form, responses, repeatableSections]);
  
  const flattenedResponsesForView = responses; // responses are now already flattened

  // Memoize all questions in order (only recalculate when form or maxInstances change)
  const allQuestionsInOrder = useMemo(() => {
    if (!form) return [];
    const questions = getAllQuestionsInOrder(form, overallMaxInstances);
    console.log('🔍 Generated all questions in order (memoized):', {
      overallMaxInstances,
      totalColumns: questions.length
    });
    return questions;
  }, [form, overallMaxInstances]);

  // Handler functions
  const handleEditResponse = (rowData: any) => {
    if (rowData.isExisting && rowData.responseId) {
      // For flattened responses, use the first original response for editing
      // (or find the response by ID if it's not a grouped response)
      let responseToEdit: FormResponse | null = null;
      
      if (rowData.originalResponses && rowData.originalResponses.length > 0) {
        // Use first original response from the group
        responseToEdit = rowData.originalResponses[0];
      } else {
        // Fallback: find flattened response and extract first original response
        const flattenedResponse = responses.find(r => r.id === rowData.responseId);
        if (flattenedResponse && flattenedResponse.originalResponses && flattenedResponse.originalResponses.length > 0) {
          responseToEdit = flattenedResponse.originalResponses[0];
        }
      }
      
      if (responseToEdit) {
        setSelectedResponse(responseToEdit);
        setEditModalOpen(true);
      }
    }
  };

  const handleResponseUpdated = (updatedResponse: FormResponse) => {
    // Find and update the flattened response that contains this original response
    setResponses(prev => prev.map(flattenedResponse => {
      if (flattenedResponse.originalResponses.some(orig => orig.id === updatedResponse.id)) {
        // Update the original response in the flattened response
        const updatedOriginalResponses = flattenedResponse.originalResponses.map(orig => 
          orig.id === updatedResponse.id ? updatedResponse : orig
        );
        return {
          ...flattenedResponse,
          originalResponses: updatedOriginalResponses,
          // Update the main properties if this was the primary response
          ...(flattenedResponse.id === updatedResponse.id ? {
            isComplete: updatedResponse.isComplete,
            submittedAt: updatedResponse.submittedAt || null,
            startedAt: updatedResponse.startedAt || null,
            data: { ...flattenedResponse.data, ...updatedResponse.data }
          } : {})
        };
      }
      return flattenedResponse;
    }));
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (confirm('Are you sure you want to delete this response? This action cannot be undone.')) {
      try {
        await deleteFormResponse(projectId!, form!.id, responseId);
        // Remove the flattened response that contains this response ID
        setResponses(prev => prev.filter(flattenedResponse => 
          !flattenedResponse.originalResponses.some(orig => orig.id === responseId) && 
          flattenedResponse.id !== responseId
        ));
      } catch (error) {
        console.error('Error deleting response:', error);
      }
    }
  };

  // Generate table rows including blank rows for manual entry
  const generateTableRows = () => {
    const rows = [];
    
    // Add existing flattened responses
    flattenedResponsesForView.forEach((flattenedResponse, index) => {
      rows.push({
        rowIndex: startIndex + index,
        responseId: flattenedResponse.id,
        isExisting: true,
        data: flattenedResponse.data, // Use flattened data with instance keys
        attachments: flattenedResponse.attachments || [],
        respondentEmail: flattenedResponse.respondentEmail,
        isComplete: flattenedResponse.isComplete,
        submittedAt: flattenedResponse.submittedAt,
        startedAt: flattenedResponse.startedAt,
        originalResponses: flattenedResponse.originalResponses // Keep reference for editing
      });
    });
    
    // Add blank rows for manual entry
    const blankRowsNeeded = itemsPerPage - flattenedResponsesForView.length;
    for (let i = 0; i < blankRowsNeeded; i++) {
      const rowIndex = startIndex + flattenedResponsesForView.length + i;
      rows.push({
        rowIndex,
        responseId: null,
        isExisting: false,
        data: manualData[rowIndex] || {},
        attachments: [],
        respondentEmail: null,
        isComplete: false,
        submittedAt: null,
        startedAt: null,
        originalResponses: []
      });
    }
    
    return rows;
  };

  const tableRows = generateTableRows();

  // Reset to first page when status filter or date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilter]);

  // Calculate analytics using server-side stats for totals
  const analytics = {
    totalResponses: responseStats.totalAll,
    completeResponses: responseStats.totalComplete,
    incompleteResponses: responseStats.totalIncomplete,
    // Average completion time is calculated from current page responses (approximation)
    averageCompletionTime: responses
      .filter(r => r.isComplete && r.submittedAt && r.startedAt)
      .reduce((acc, r) => {
        const submittedAt = r.submittedAt instanceof Date ? r.submittedAt : new Date(r.submittedAt!);
        const startedAt = r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt!);
        const timeMs = submittedAt.getTime() - startedAt.getTime();
        return acc + timeMs / (1000 * 60);
      }, 0) / Math.max(responses.filter(r => r.isComplete).length, 1),
  };

  const handleManualDataChange = (rowIndex: number, questionId: string, value: any) => {
    setManualData(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [questionId]: value
      }
    }));
  };

  const handleSaveManualData = (rowIndex: number) => {
    if (!formId || !form) return;
    
    const rowData = manualData[rowIndex];
    if (!rowData || Object.keys(rowData).length === 0) {
      toast({
        title: "No Data to Save",
        description: "Please enter some data before saving.",
        variant: "destructive",
      });
      return;
    }

    // Create a new form response from manual data
    const newResponse: FormResponse = {
      id: `manual-${Date.now()}-${rowIndex}`,
      formId: formId,
      formVersion: form.version || 1,
      respondentEmail: undefined,
      startedAt: new Date(),
      submittedAt: new Date(),
      isComplete: true,
      data: rowData,
      attachments: [],
      ipAddress: 'manual-entry',
      userAgent: 'manual-entry'
    };

    // Add the response to storage
    addFormResponseToStorage(newResponse);
    
    // Clear the manual data for this row
    setManualData(prev => {
      const newData = { ...prev };
      delete newData[rowIndex];
      return newData;
    });

    toast({
      title: "Data Saved",
      description: "Manual data has been saved as a new response.",
    });
  };

  const handleExportData = async () => {
    if (!form || !projectId || !formId) return;
    if (!canExport) {
      toast({
        title: 'Export not allowed',
        description: 'You do not have permission to export form responses for this project.',
        variant: 'destructive',
      });
      return;
    }

    // Show loading toast
    toast({
      title: "Exporting...",
      description: "Fetching all responses for export. This may take a moment for large datasets.",
    });

    try {
      // Fetch ALL responses using the optimized export endpoint
      console.log('📤 Starting export - fetching all responses...');
      const exportResult = await formsApi.getFormResponsesForExport(projectId, formId, {
        status: statusFilter as 'all' | 'complete' | 'incomplete'
      });
      console.log(`✅ Fetched ${exportResult.total} responses for export`);

      const allResponses = exportResult.responses;
      
      // Group responses by submission (for repeatable sections) - same logic as view
      const responseGroups = groupResponsesBySubmission(allResponses, form);
      console.log('📤 Export: Grouped responses:', {
        totalRawResponses: allResponses.length,
        groupCount: responseGroups.size,
        groups: Array.from(responseGroups.entries()).map(([key, responses]) => ({
          groupKey: key,
          responseCount: responses.length
        }))
      });
      
      // Flatten grouped responses first (same logic as view)
      const flattenedResponses: FlattenedResponse[] = [];
      responseGroups.forEach((groupResponses, groupKey) => {
        console.log(`📤 Export: Processing group ${groupKey} with ${groupResponses.length} responses`);
        const flattened = flattenGroupedResponses(groupResponses, form);
        if (flattened) {
          console.log(`📤 Export: Flattened response created:`, {
            id: flattened.id,
            originalResponseCount: flattened.originalResponses.length,
            dataKeys: Object.keys(flattened.data).filter(k => k.includes('_instance_'))
          });
          flattenedResponses.push(flattened);
        }
      });
      
      // Calculate max instances from flattened responses (same logic as view)
      const repeatableSections = getRepeatableSections(form);
      const maxInstancesBySection = new Map<string, number>();
      
      repeatableSections.forEach(section => {
        let maxInstances = 0;
        flattenedResponses.forEach((flattenedResponse) => {
          if (flattenedResponse.originalResponses && flattenedResponse.originalResponses.length > 1) {
            // Multiple original responses = multiple instances
            const hasExplicitMetadata = flattenedResponse.originalResponses.some(orig => {
              const metadata = parseRepeatableMetadata(orig.source);
              return metadata.isRepeatable && metadata.repeatableSectionId === section.id;
            });
            
            if (hasExplicitMetadata) {
              maxInstances = Math.max(maxInstances, flattenedResponse.originalResponses.length);
            } else if (repeatableSections.length === 1) {
              maxInstances = Math.max(maxInstances, flattenedResponse.originalResponses.length);
            } else {
              const hasDataForThisSection = flattenedResponse.originalResponses.some(orig => {
                return section.questions.some(q => orig.data[q.id] !== undefined);
              });
              if (hasDataForThisSection) {
                maxInstances = Math.max(maxInstances, flattenedResponse.originalResponses.length);
              }
            }
          }

          // Also detect instance count from single-response object values (new format: { "0": v, "1": v, ... })
          section.questions.forEach(q => {
            const val = flattenedResponse.data[q.id];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const numericKeys = Object.keys(val).filter(k => /^\d+$/.test(k));
              if (numericKeys.length > 1) {
                maxInstances = Math.max(maxInstances, numericKeys.length);
              }
            }
          });
        });
        maxInstancesBySection.set(section.id, maxInstances || 1);
      });
      
      // Get overall max instances (for column generation)
      const overallMaxInstances = Math.max(...Array.from(maxInstancesBySection.values()), 1);
      console.log('📤 Export: Calculated max instances:', {
        overallMaxInstances,
        bySection: Object.fromEntries(maxInstancesBySection),
        flattenedResponseCount: flattenedResponses.length
      });
    
    // Helper function to escape CSV values
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      
      const stringValue = String(value);
      // If value contains comma, newline, or quote, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Helper function to format dates as mm-dd-yyyy
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return '';
      
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      return `${month}-${day}-${year}`;
    };

      // Helper function to format question value for CSV
      const formatQuestionValue = (value: any, question: any): string => {
        if (value === undefined || value === null) return '';
        
        if (Array.isArray(value)) {
          return value.join('; ');
        } else if (question.type === 'SINGLE_CHOICE' && question.options) {
          const option = question.options.find((opt: any) => opt.value === value);
          return option ? option.label : String(value);
        } else if (question.type === 'MULTIPLE_CHOICE' && question.options) {
          const selectedOptions = Array.isArray(value) ? value : [value];
          const optionLabels = selectedOptions.map((val: any) => {
            const option = question.options.find((opt: any) => opt.value === val);
            return option ? option.label : val;
          });
          return optionLabels.join('; ');
        } else if (question.type === 'DATE' || question.type === 'DATETIME') {
          return formatDate(value);
        } else if (question.type === 'LOCATION') {
          if (typeof value === 'object' && value !== null) {
            const lat = value.latitude ?? value.lat ?? '';
            const lng = value.longitude ?? value.lng ?? '';
            return `${lat}, ${lng}`;
          }
          return String(value);
        }
        // Avoid "[object Object]" for unexpected object values from backend
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return JSON.stringify(value);
        }
        return String(value);
    };

    // Create CSV content - metadata columns first, then question columns in same order as viewer (including repeatable instance columns)
    const allQuestions = getAllQuestionsInOrder(form, overallMaxInstances);
    const headers = [
      'Response ID',
      'Email',
      'Status',
      'Submitted At',
      'Completion Time (minutes)'
    ];
    allQuestions.forEach(({question, isConditional, parentQuestion, parentOption, isRepeatable, instanceIndex, instanceKey}) => {
      let headerTitle = question.title;
      if (isRepeatable && instanceIndex !== undefined) {
        headerTitle = `${question.title} (Instance ${instanceIndex + 1})`;
      }
      if (isConditional) {
        headerTitle = `${question.title} (Conditional: ${parentQuestion?.title || 'Unknown'} → ${parentOption?.label || parentOption})${isRepeatable && instanceIndex !== undefined ? ` - Instance ${instanceIndex + 1}` : ''}`;
      }
      if (question.type === 'LOCATION') {
        headers.push(`${headerTitle} - Latitude`);
        headers.push(`${headerTitle} - Longitude`);
        headers.push(`${headerTitle} - Accuracy`);
        headers.push(`${headerTitle} - Address`);
      } else {
        headers.push(headerTitle);
      }
    });

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
        ...flattenedResponses.map(flattenedResponse => {
          const completionTime = flattenedResponse.submittedAt && flattenedResponse.startedAt
            ? Math.round(((new Date(flattenedResponse.submittedAt)).getTime() - (new Date(flattenedResponse.startedAt)).getTime()) / (1000 * 60))
          : '';

        const row: (string | number)[] = [
          flattenedResponse.id,
          flattenedResponse.respondentEmail || 'Anonymous',
          flattenedResponse.isComplete ? 'Complete' : 'Incomplete',
          flattenedResponse.submittedAt ? formatDate(flattenedResponse.submittedAt) : 'Not submitted',
          completionTime
        ];
        // Add question values in same order as viewer (including repeatable instance columns)
        allQuestions.forEach(({question, isConditional, parentQuestion, instanceKey}) => {
          let value;
            let attachments: MediaAttachment[] = [];
            
            // Determine the key to use for lookup
            const dataKey = instanceKey || question.id;
            const parentQuestionId = parentQuestion?.id;
          
          if (isConditional && parentQuestionId) {
              // For conditional questions in repeatable sections
              if (instanceKey) {
                // Repeatable conditional - parent may be data[parentId_instance_N] or data[parentId]["N"]
                const instanceIndexStr = instanceKey.split('_instance_')[1];
                let parentResponseValue = flattenedResponse.data[`${parentQuestionId}_instance_${instanceIndexStr}`];
                if (parentResponseValue === undefined && instanceIndexStr != null) {
                  const byParent = flattenedResponse.data[parentQuestionId];
                  if (typeof byParent === 'object' && byParent !== null && !Array.isArray(byParent)) {
                    parentResponseValue = byParent[instanceIndexStr] ?? byParent[Number(instanceIndexStr)];
                  }
                }
                if (typeof parentResponseValue === 'object' && parentResponseValue !== null) {
                  value = parentResponseValue[question.id];
                } else {
                  value = null;
                }
              } else {
                // Non-repeatable conditional question
                const parentResponseValue = flattenedResponse.data[parentQuestionId];
                if (typeof parentResponseValue === 'object' && parentResponseValue !== null) {
                  value = parentResponseValue[question.id];
                } else {
                  value = null;
                }
              }
            } else {
              // For main questions, use flattened data with instance key if applicable
              value = flattenedResponse.data[dataKey];
              // Single response with repeatable data stored as object { "0": v0, "1": v1 } (or unexpanded legacy data)
              if (value === undefined && instanceKey) {
                const instanceIndexStr = instanceKey.split('_instance_')[1];
                const byQuestion = flattenedResponse.data[question.id];
                if (instanceIndexStr != null && typeof byQuestion === 'object' && byQuestion !== null && !Array.isArray(byQuestion)) {
                  value = byQuestion[instanceIndexStr] ?? byQuestion[Number(instanceIndexStr)];
                }
                // Scalar fallback: bare questionId holds the instance-0 value (old-format single-child responses)
                if (value === undefined && instanceIndexStr === '0' && byQuestion !== undefined && (typeof byQuestion !== 'object' || Array.isArray(byQuestion))) {
                  value = byQuestion;
                }
              }
              // Safety: if value is still the whole repeatable object (e.g. unexpanded), extract this instance
              if (instanceKey && typeof value === 'object' && value !== null && !Array.isArray(value) && !('_parentValue' in value)) {
                const instanceIndexStr = instanceKey.split('_instance_')[1];
                if (instanceIndexStr != null && (instanceIndexStr in value || Number(instanceIndexStr) in value)) {
                  value = value[instanceIndexStr] ?? value[Number(instanceIndexStr)];
                }
              }
              // Handle nested structure for parent questions that have conditional children
              if (typeof value === 'object' && value !== null && !Array.isArray(value) && value._parentValue !== undefined) {
                value = value._parentValue;
              }
            }
          
            // Get attachments for this question (check all original responses)
            flattenedResponse.originalResponses.forEach(originalResponse => {
              const questionAttachments = originalResponse.attachments?.filter(att => att.questionId === question.id) || [];
              attachments.push(...questionAttachments);
            });
            
            // Handle links in media upload questions
            if ((question.type === 'IMAGE_UPLOAD' || question.type === 'VIDEO_UPLOAD' || question.type === 'AUDIO_UPLOAD' || question.type === 'FILE_UPLOAD') && Array.isArray(value)) {
              // Separate links from files
              const links = value.filter((item: any) => item.type === 'link' || (typeof item === 'object' && item.url && !item.fileName && !item.name));
              const files = value.filter((item: any) => item.type !== 'link' && !(typeof item === 'object' && item.url && !item.fileName && !item.name));
              
              // Format files
              const fileInfo = files.map((file: any) => {
                const fileName = file.fileName || file.name || file.originalName || 'Unknown file';
                const fileSize = file.fileSize || file.size || 0;
                return `${fileName} (${formatFileSize(fileSize)})`;
              }).join('; ');
              
              // Format links
              const linkInfo = links.map((link: any) => {
                const url = typeof link === 'string' ? link : link.url;
                const label = typeof link === 'string' ? link : (link.label || link.url);
                return `Link: ${label} → ${url}`;
              }).join('; ');
              
              // Combine files and links
              const combinedInfo = [fileInfo, linkInfo].filter(Boolean).join(' | ');
              row.push(combinedInfo || '');
            } else if (question.type === 'LOCATION') {
            // Flatten location into 4 columns
            const lat = value && typeof value === 'object' ? (value.latitude ?? value.lat ?? '') : '';
            const lng = value && typeof value === 'object' ? (value.longitude ?? value.lng ?? '') : '';
            const acc = value && typeof value === 'object' ? (value.accuracy ?? '') : '';
            const addr = value && typeof value === 'object' ? (value.address ?? '') : '';
            row.push(String(lat));
            row.push(String(lng));
            row.push(String(acc));
            row.push(String(addr));
          } else {
              let displayValue = formatQuestionValue(value, question);
            
            // Add attachment info for media uploads
            if (attachments.length > 0) {
              const attachmentInfo = attachments.map(att => `${att.fileName} (${formatFileSize(att.fileSize)})`).join('; ');
              displayValue = displayValue ? `${displayValue} | Files: ${attachmentInfo}` : `Files: ${attachmentInfo}`;
            }
            
            row.push(displayValue);
          }
        });
        return row.map(escapeCsvValue).join(',');
      })
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
        description: `Successfully exported ${flattenedResponses.length} submission${flattenedResponses.length !== 1 ? 's' : ''} to CSV${flattenedResponses.length !== allResponses.length ? ` (${allResponses.length} individual responses grouped)` : ''}.`,
      });
    } catch (error) {
      console.error('❌ Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export responses. Please try again.",
        variant: "destructive",
      });
    }
  };

  const QuestionAnalytics = ({ questionId }: { questionId: string }) => {
    if (!form) return null;
    const question = form.sections
      .flatMap(s => s.questions)
      .find(q => q.id === questionId);
    
    if (!question) return null;

    const questionResponses = responses
      .filter(r => r.data[questionId] !== undefined)
      .map(r => r.data[questionId]);

    if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
      const valueCounts = questionResponses.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">{question.title}</h4>
          <div className="space-y-2">
            {Object.entries(valueCounts).map(([value, count]) => (
              <div key={value} className="flex justify-between items-center">
                <span className="text-sm">{value}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${((count as number) / questionResponses.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{count as number}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === 'NUMBER') {
      const numericValues = questionResponses
        .filter(v => typeof v === 'number')
        .sort((a, b) => a - b);
      
      if (numericValues.length === 0) return null;

      const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const median = numericValues[Math.floor(numericValues.length / 2)];

      return (
        <div className="p-4 border rounded-lg">
          <h4 className="font-medium mb-2">{question.title}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Average</p>
              <p className="font-medium">{avg.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Median</p>
              <p className="font-medium">{median}</p>
            </div>
            <div>
              <p className="text-gray-600">Range</p>
              <p className="font-medium">{min} - {max}</p>
            </div>
            <div>
              <p className="text-gray-600">Responses</p>
              <p className="font-medium">{numericValues.length}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 border rounded-lg">
        <h4 className="font-medium mb-2">{question.title}</h4>
        <p className="text-sm text-gray-600">
          {questionResponses.length} response{questionResponses.length !== 1 ? 's' : ''}
        </p>
      </div>
    );
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isLoading ? 'Loading Fresh Data' : 'Form Not Found'}
          </h3>
          <p className="text-gray-600">
            {isLoading ? 'Fetching latest form and response data from API...' : 'The requested form could not be found.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(`/dashboard/projects/${projectId}/forms`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forms
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{form.title}</h1>
            <p className="text-gray-600">Form Responses & Analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={form.status === 'PUBLISHED' ? 'default' : 'secondary'}>
            {form.status}
          </Badge>
          {canExport && (
            <Button onClick={handleExportData} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{analytics.totalResponses}</p>
                <p className="text-xs text-gray-500">Total Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{analytics.completeResponses}</p>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <PieChart className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{analytics.incompleteResponses}</p>
                <p className="text-xs text-gray-500">Incomplete</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{analytics.averageCompletionTime.toFixed(1)}m</p>
                <p className="text-xs text-gray-500">Avg. Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Responses Section */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Responses ({totalResponses})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search responses by email or content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responses Table */}
          <Card>
            <CardHeader>
              
            </CardHeader>
            <CardContent>
              {filteredResponses.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No responses found</p>
                  <p className="text-sm text-gray-500">
                    {responses.length === 0 ? 'No responses have been submitted yet' : 'Try adjusting your filters'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="border-collapse">
                  <TableHeader>
                      <TableRow className="border-b border-gray-300">
                        {/* Row ID column - stays on the left */}
                        <TableHead className="sticky left-0 bg-white z-10 border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                          Row ID
                        </TableHead>
                        
                        {/* Question columns - including conditional questions and instance columns for repeatable sections */}
                        {allQuestionsInOrder.map(({ question, isConditional, parentQuestion, parentOption, isRepeatable, instanceIndex, instanceKey }) => {
                          const columnKey = instanceKey || question.id;
                          
                          if (isConditional) {
                            // Conditional question column
                            return (
                              <TableHead key={columnKey} className="min-w-[150px] border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900 bg-blue-50">
                                <div>
                                  <div className="font-medium text-blue-800">
                                    {question.title}
                                    {isRepeatable && instanceIndex !== undefined && (
                                      <span className="text-blue-600 ml-1">(Instance {instanceIndex + 1})</span>
                                    )}
                                    <span className="text-blue-600 ml-1">*</span>
                                  </div>
                                  <div className="text-blue-600 text-xs">
                                    {question.type.replace('_', ' ')} (conditional)
                                  </div>
                                  <div className="text-blue-500 text-xs">
                                    from: {parentQuestion?.title} → {parentOption?.label}
                                  </div>
                                </div>
                              </TableHead>
                            );
                          } else {
                            // Main question column
                            return (
                              <TableHead key={columnKey} className="min-w-[150px] border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                                <div>
                                  <div className={`${question.isRequired ? 'font-bold' : 'font-medium'}`}>
                                    {question.title}
                                    {isRepeatable && instanceIndex !== undefined && (
                                      <span className="text-purple-600 ml-1 text-xs">(Instance {instanceIndex + 1})</span>
                                    )}
                                    {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                                  </div>
                                  <div className="text-gray-500">
                                    {question.type.replace('_', ' ')}
                                    {isRepeatable && <span className="text-purple-500 ml-1">(repeatable)</span>}
                                  </div>
                                </div>
                              </TableHead>
                            );
                          }
                        })}
                        
                        {/* Metadata columns - moved to the right */}
                        <TableHead className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                          Status
                        </TableHead>
                        <TableHead className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                          Submitted
                        </TableHead>
                        <TableHead className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                          Completion Time
                        </TableHead>
                        <TableHead className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2 text-xs font-medium text-gray-900">
                          Actions
                        </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {tableRows.map((row) => {
                        const completionTime = row.submittedAt && row.startedAt
                          ? Math.round(((new Date(row.submittedAt)).getTime() - (new Date(row.startedAt)).getTime()) / (1000 * 60))
                        : null;

                      return (
                          <TableRow key={row.rowIndex} className={`border-b border-gray-300 ${!row.isExisting ? 'bg-gray-50' : ''}`}>
                            {/* Row ID cell - stays on the left */}
                            <TableCell className="sticky left-0 bg-white z-10 border border-gray-300 px-2 py-2">
                              <div className="text-xs font-medium">
                                {row.rowIndex + 1}
                            </div>
                          </TableCell>
                            
                            {/* Question response cells - matching the header structure exactly */}
                            {allQuestionsInOrder.map(({ question, isConditional, parentQuestion, instanceKey }) => {
                              const cellKey = instanceKey || question.id;
                              
                              if (isConditional) {
                                // For conditional questions, extract response from parent question's nested data
                                // Handle both repeatable and non-repeatable conditional questions
                                let conditionalResponse = null;
                                
                                if (instanceKey) {
                                  // Repeatable conditional - parent may be row.data[parentId_instance_N] or row.data[parentId]["N"]
                                  const instanceIndexStr = instanceKey.split('_instance_')[1];
                                  let parentResponseValue = row.data[`${parentQuestion?.id}_instance_${instanceIndexStr}`];
                                  if (parentResponseValue === undefined && instanceIndexStr != null) {
                                    const byParent = row.data[parentQuestion?.id || ''];
                                    if (typeof byParent === 'object' && byParent !== null && !Array.isArray(byParent)) {
                                      parentResponseValue = byParent[instanceIndexStr] ?? byParent[Number(instanceIndexStr)];
                                    }
                                  }
                                  if (typeof parentResponseValue === 'object' && parentResponseValue !== null) {
                                    conditionalResponse = parentResponseValue[question.id];
                                  }
                                } else {
                                  // Non-repeatable conditional question
                                  const parentResponseValue = row.data[parentQuestion?.id || ''];
                                  if (typeof parentResponseValue === 'object' && parentResponseValue !== null) {
                                    conditionalResponse = parentResponseValue[question.id];
                                  }
                                }
                                
                                return (
                                  <TableCell key={cellKey} className="min-w-[150px] border border-gray-300 px-2 py-2 bg-blue-50">
                                    <div className="text-xs">
                                      {conditionalResponse !== null && conditionalResponse !== undefined ? (
                                        <div className="text-blue-800">
                                          {typeof conditionalResponse === 'object' 
                                            ? JSON.stringify(conditionalResponse) 
                                            : String(conditionalResponse)
                                          }
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 italic">No response</div>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              } else {
                                // For main questions, use flattened data with instance key if applicable
                                const dataKey = instanceKey || question.id;
                                let responseValue = row.data[dataKey];
                                // Single response with repeatable data stored as object { "0": v0, "1": v1 }
                                if (responseValue === undefined && instanceKey) {
                                  const instanceIndexFromKey = instanceKey.split('_instance_')[1];
                                  const byQuestion = row.data[question.id];
                                  if (instanceIndexFromKey != null && typeof byQuestion === 'object' && byQuestion !== null && !Array.isArray(byQuestion)) {
                                    responseValue = byQuestion[instanceIndexFromKey] ?? byQuestion[Number(instanceIndexFromKey)];
                                  }
                                  // Scalar fallback: bare questionId holds the instance-0 value (old-format single-child responses)
                                  if (responseValue === undefined && instanceIndexFromKey === '0' && byQuestion !== undefined && (typeof byQuestion !== 'object' || Array.isArray(byQuestion))) {
                                    responseValue = byQuestion;
                                  }
                                }
                                // Safety: if value is still the whole repeatable object (unexpanded), extract this instance
                                if (instanceKey && typeof responseValue === 'object' && responseValue !== null && !Array.isArray(responseValue) && !('_parentValue' in responseValue)) {
                                  const instanceIndexFromKey = instanceKey.split('_instance_')[1];
                                  if (instanceIndexFromKey != null && (instanceIndexFromKey in responseValue || Number(instanceIndexFromKey) in responseValue)) {
                                    responseValue = responseValue[instanceIndexFromKey] ?? responseValue[Number(instanceIndexFromKey)];
                                  }
                                }
                                
                                // Get attachments for this question (from original responses if available)
                                let attachments: MediaAttachment[] = [];
                                if (row.originalResponses && row.originalResponses.length > 0) {
                                  row.originalResponses.forEach((originalResponse: FormResponse) => {
                                    const questionAttachments = originalResponse.attachments?.filter((att: any) => att.questionId === question.id) || [];
                                    attachments.push(...questionAttachments);
                                  });
                                } else {
                                  attachments = row.attachments?.filter((att: any) => att.questionId === question.id) || [];
                                }
                                
                                // Extract the actual parent response value (handle nested structure)
                                let actualResponseValue = responseValue;
                                if (typeof responseValue === 'object' && responseValue !== null && !Array.isArray(responseValue) && responseValue._parentValue !== undefined) {
                                  actualResponseValue = responseValue._parentValue;
                                }
                                
                                return (
                                  <TableCell key={cellKey} className="min-w-[150px] border border-gray-300 px-2 py-2">
                                    <ResponseCell 
                                      question={question}
                                      value={actualResponseValue}
                                      attachments={attachments}
                                      isEditable={!row.isExisting}
                                      onValueChange={(value) => handleManualDataChange(row.rowIndex, dataKey, value)}
                                      responseData={row.data}
                                    />
                                  </TableCell>
                                );
                              }
                            })}
                            
                            {/* Metadata cells - moved to the right */}
                            <TableCell className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2">
                              <Badge variant={row.isComplete ? 'default' : 'secondary'} className="text-xs">
                                {row.isExisting ? (row.isComplete ? 'Complete' : 'Incomplete') : 'Draft'}
                            </Badge>
                          </TableCell>
                            <TableCell className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2">
                              <div className="text-xs">
                                {row.isExisting && row.submittedAt
                                  ? (new Date(row.submittedAt)).toLocaleDateString()
                                  : row.isExisting ? 'Not submitted' : 'Not saved'
                              }
                            </div>
                          </TableCell>
                            <TableCell className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2">
                              <div className="text-xs">
                                {row.isExisting && completionTime ? `${completionTime}m` : 'N/A'}
                              </div>
                          </TableCell>
                            <TableCell className="sticky right-0 bg-white z-10 border border-gray-300 px-2 py-2">
                            {row.isExisting ? (
                              (canEdit || canDelete) ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-6 w-6 p-0">
                                          <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {canEdit && (
                                      <DropdownMenuItem 
                                        onClick={() => handleEditResponse(row)}
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit Response
                                      </DropdownMenuItem>
                                    )}
                                    {canDelete && (
                                      <DropdownMenuItem 
                                            onClick={() => handleDeleteResponse(row.responseId!)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null
                            ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveManualData(row.rowIndex)}
                                  className="h-6 px-2 text-xs"
                                  disabled={!manualData[row.rowIndex] || Object.keys(manualData[row.rowIndex] || {}).length === 0}
                                >
                                  Save
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalResponses > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, totalResponses)} of {totalResponses} responses
                    </div>
                    <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="25">25 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setCurrentPage(pageNum)}
                              isActive={currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Question Analytics Section */}
          <Card>
            <CardHeader>
              <CardTitle>Question Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.sections.flatMap(section => 
                  section.questions.map(question => (
                    <QuestionAnalytics key={question.id} questionId={question.id} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

      {/* Summary Report Section */}
          <Card>
            <CardHeader>
              <CardTitle>Summary Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Form Performance</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {((analytics.completeResponses / analytics.totalResponses) * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-blue-700">Completion Rate</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.averageCompletionTime.toFixed(1)}
                      </p>
                      <p className="text-sm text-green-700">Avg. Minutes</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {form.sections.reduce((total, section) => total + section.questions.length, 0)}
                      </p>
                      <p className="text-sm text-purple-700">Total Questions</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {responses.filter(r => r.startedAt && (new Date(r.startedAt)).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length}
                      </p>
                      <p className="text-sm text-orange-700">This Week</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Activity Integration</h4>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      Response data is automatically synchronized with linked project activities and KPI calculations.
                      Real-time updates are reflected in project dashboards and progress tracking.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
      </Card>
      
      {/* Response Edit Modal */}
        {selectedResponse && form && projectId && (
          <ResponseEditModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedResponse(null);
            }}
            form={form}
            response={selectedResponse}
            projectId={projectId}
            onResponseUpdated={handleResponseUpdated}
          />
        )}
        </div>

        
    
    );
  }
 
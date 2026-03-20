import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { NumberQuestion } from '../../form-creation-wizard/types';
import { getNumberQuestionRangeError } from '../utils/questionUtils';

interface NumberQuestionRendererProps extends BaseQuestionRendererProps {
  question: NumberQuestion;
  value?: number;
  onChange?: (value: number | undefined) => void;
}

export function NumberQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode
}: NumberQuestionRendererProps) {
  const rangeError = useMemo(() => getNumberQuestionRangeError(question, value), [question, value]);
  const displayError = error || rangeError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange?.(undefined);
      return;
    }
    const numValue = Number(newValue);
    if (isNaN(numValue)) return;
    onChange?.(numValue);
  };

  const rangeHint =
    question.min != null && question.max != null
      ? `Enter a number from ${question.min} to ${question.max} (inclusive).`
      : question.min != null
        ? `Minimum: ${question.min}.`
        : question.max != null
          ? `Maximum: ${question.max}.`
          : null;

  return (
    <BaseQuestionRenderer question={question} error={displayError} isPreviewMode={isPreviewMode}>
      <Input
        type="number"
        value={value !== undefined ? value.toString() : ''}
        onChange={handleChange}
        placeholder={question.placeholder || 'Enter a number...'}
        step={question.step ?? 1}
        className={isPreviewMode ? 'bg-blue-50 border-blue-200' : ''}
        aria-invalid={displayError ? true : undefined}
      />
      {rangeHint && (
        <p className="text-xs text-muted-foreground mt-1">{rangeHint}</p>
      )}
    </BaseQuestionRenderer>
  );
}
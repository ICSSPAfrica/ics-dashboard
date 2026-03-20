import { FormQuestion, SingleChoiceQuestion, MultipleChoiceQuestion, NumberQuestion } from '../../form-creation-wizard/types';

/** True when the user has entered a value (NUMBER questions: a finite number). */
export function isNumberQuestionValueFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return !Number.isNaN(n);
  }
  return false;
}

/**
 * When a NUMBER question has min/max and the value is filled but out of range, return a user-facing message.
 */
export function getNumberQuestionRangeError(question: FormQuestion, value: unknown): string | undefined {
  if (question.type !== 'NUMBER') return undefined;
  if (!isNumberQuestionValueFilled(value)) return undefined;

  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return undefined;

  const q = question as NumberQuestion;
  const hasMin = q.min != null;
  const hasMax = q.max != null;
  if (!hasMin && !hasMax) return undefined;

  if (hasMin && num < q.min!) {
    if (hasMax) return `Enter a number between ${q.min} and ${q.max} (inclusive).`;
    return `Enter a number of at least ${q.min}.`;
  }
  if (hasMax && num > q.max!) {
    if (hasMin) return `Enter a number between ${q.min} and ${q.max} (inclusive).`;
    return `Enter a number of at most ${q.max}.`;
  }
  return undefined;
}

/**
 * Helper function to identify if a question is a conditional question
 * Conditional questions are those that appear in option.conditionalQuestions
 * or are marked with isConditional flag in their config
 */
export function isConditionalQuestion(question: FormQuestion, allQuestions: FormQuestion[]): boolean {
  // First check if the question has isConditional flag in config (more efficient)
  if ((question as any).config?.isConditional || (question as any).isConditional) {
    return true;
  }
  
  // Fallback: Check if this question appears in any option's conditionalQuestions
  for (const otherQuestion of allQuestions) {
    // Only choice questions have options
    if (otherQuestion.type === 'SINGLE_CHOICE' || otherQuestion.type === 'MULTIPLE_CHOICE') {
      const choiceQuestion = otherQuestion as SingleChoiceQuestion | MultipleChoiceQuestion;
      
      // Check options in both question.options and question.config.options
      const options = choiceQuestion.options || (choiceQuestion as any).config?.options || [];
      
      for (const option of options) {
        if (option.conditionalQuestions) {
          const isInConditionalQuestions = option.conditionalQuestions.some(
            (condQuestion: any) => condQuestion.id === question.id
          );
          if (isInConditionalQuestions) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Filter out conditional questions from the main question list
 * Conditional questions should only be rendered when their parent option is selected
 */
export function filterMainQuestions(questions: FormQuestion[]): FormQuestion[] {
  return questions.filter(question => !isConditionalQuestion(question, questions));
}

/**
 * Get all conditional questions for a specific parent question and option
 */
export function getConditionalQuestionsForOption(
  parentQuestion: FormQuestion, 
  optionId: string, 
  allQuestions: FormQuestion[]
): FormQuestion[] {
  // Only choice questions have options
  if (parentQuestion.type !== 'SINGLE_CHOICE' && parentQuestion.type !== 'MULTIPLE_CHOICE') {
    return [];
  }

  const choiceQuestion = parentQuestion as SingleChoiceQuestion | MultipleChoiceQuestion;
  
  // Check options in both question.options and question.config.options
  const options = choiceQuestion.options || (choiceQuestion as any).config?.options || [];
  const option = options.find((opt: any) => opt.id === optionId);
  
  if (!option || !option.conditionalQuestions) {
    return [];
  }

  // Find the actual question objects from the allQuestions list
  return option.conditionalQuestions
    .map((condQuestion: any) => allQuestions.find((q: FormQuestion) => q.id === condQuestion.id))
    .filter((q): q is FormQuestion => q !== undefined);
}

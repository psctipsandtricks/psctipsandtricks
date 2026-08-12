export interface QuizOption {
  id: string;
  text: string;
  explanation?: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  marks?: number;
  explanation?: string;
  options: QuizOption[];
  correctOptionId: string;
}

export interface QuestionFormErrors {
  /** Message for the question prompt field, if it is invalid. */
  text?: string;
  /** Message per option index, keyed by position in the options array. */
  options: Record<number, string>;
  /** Message about the correct-answer selection. */
  correctOption?: string;
  /** Every problem, phrased for the summary banner at the top of the modal. */
  summary: string[];
}

export const optionLetter = (index: number) => String.fromCharCode(65 + index);

/**
 * A question is only saveable when the prompt is filled, every option row
 * carries unique text, and one of those filled options is marked correct.
 * Empty option rows are rejected rather than silently dropped — a blank choice
 * would otherwise reach students as an unselectable answer.
 */
export const validateQuestionForm = (form: QuizQuestion): QuestionFormErrors => {
  const errors: QuestionFormErrors = { options: {}, summary: [] };

  if (!form.text.trim()) {
    errors.text = 'Question prompt is required.';
    errors.summary.push('The question prompt is empty.');
  }

  if (form.options.length < 2) {
    errors.summary.push('A question needs at least 2 answer options.');
  }

  const emptyLetters: string[] = [];
  form.options.forEach((opt, idx) => {
    if (!opt.text.trim()) {
      errors.options[idx] = 'Option text is required.';
      emptyLetters.push(optionLetter(idx));
    }
  });
  if (emptyLetters.length > 0) {
    errors.summary.push(
      emptyLetters.length === 1
        ? `Option ${emptyLetters[0]} is empty — fill it in or remove it.`
        : `Options ${emptyLetters.join(', ')} are empty — fill them in or remove the ones you don't need.`,
    );
  }

  const normalized = form.options.map((o) => o.text.trim().toLowerCase());
  const duplicateLetters: string[] = [];
  normalized.forEach((value, idx) => {
    if (value !== '' && normalized.filter((other) => other === value).length > 1) {
      errors.options[idx] = 'Duplicate option — every choice must be unique.';
      duplicateLetters.push(optionLetter(idx));
    }
  });
  if (duplicateLetters.length > 0) {
    errors.summary.push(`Options ${duplicateLetters.join(', ')} repeat the same text. Every choice must be unique.`);
  }

  const correctOption = form.options.find((o) => o.id === form.correctOptionId);
  if (!correctOption) {
    errors.correctOption = 'Select the correct answer.';
    errors.summary.push('No correct answer is selected — click an option’s letter button to mark it.');
  } else if (!correctOption.text.trim()) {
    errors.correctOption = 'The option marked correct has no text.';
    errors.summary.push('The option marked as the correct answer is empty.');
  }

  return errors;
};

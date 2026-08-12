export interface NegativeMarkingRules {
  negativeMarkingEnabled: boolean;
  /** Deduct `negativeMarkingDeduct` marks for every this-many wrong answers. */
  negativeMarkingEvery: number;
  negativeMarkingDeduct: number;
  /** When false (the default), the result is floored at 0. */
  allowNegativeScore: boolean;
}

/**
 * Negative marking here is a grouped rule — "for every N wrong answers,
 * deduct M marks" — not a flat per-question penalty. A partial group (e.g. 2
 * wrong answers under a "3 wrong = -1" rule) costs nothing yet, matching how
 * this is described to students and admins alike.
 */
export function computeFinalScore(positiveScore: number, wrongCount: number, rules: NegativeMarkingRules): number {
  const deduction = rules.negativeMarkingEnabled
    ? Math.floor(wrongCount / Math.max(1, rules.negativeMarkingEvery)) * rules.negativeMarkingDeduct
    : 0;
  const raw = positiveScore - deduction;
  const bounded = rules.allowNegativeScore ? raw : Math.max(0, raw);
  return Math.round(bounded * 100) / 100;
}

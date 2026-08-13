export interface NegativeMarkingRules {
  negativeMarkingEnabled?: boolean | null;
  /** Deduct `negativeMarkingDeduct` marks for every this-many wrong answers. */
  negativeMarkingEvery?: number | null;
  negativeMarkingDeduct?: number | null;
  /** When false (the default), the result is floored at 0. */
  allowNegativeScore?: boolean | null;
}

/**
 * Negative marking here is a grouped rule — "for every N wrong answers,
 * deduct M marks" — not a flat per-question penalty. A partial group (e.g. 2
 * wrong answers under a "3 wrong = -1" rule) costs nothing yet, matching how
 * this is described to students and admins alike.
 */
export function computeFinalScore(
  positiveScore: number,
  wrongCount: number,
  rules?: Partial<NegativeMarkingRules> | null,
): number {
  if (!rules || !rules.negativeMarkingEnabled) {
    return positiveScore;
  }
  const every = Math.max(1, rules.negativeMarkingEvery ?? 1);
  const deduct = rules.negativeMarkingDeduct ?? 0;
  const deduction = Math.floor(wrongCount / every) * deduct;
  const raw = positiveScore - deduction;
  const bounded = rules.allowNegativeScore ? raw : Math.max(0, raw);
  return Math.round(bounded * 100) / 100;
}

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// A qualitative read on a score, layered on top of the pass/fail verdict.
///
/// "Not Passed" only says whether the cutoff was cleared — it reads the same
/// whether a student missed it by two marks or scored close to zero. This adds
/// the difference back, and applies to every attempt, passed or not, so a
/// student always has some sense of how they actually did.
enum PerformanceBand { excellent, good, average, needsImprovement }

extension PerformanceBandX on PerformanceBand {
  String get label => switch (this) {
        PerformanceBand.excellent => 'Excellent',
        PerformanceBand.good => 'Good',
        PerformanceBand.average => 'Average',
        PerformanceBand.needsImprovement => 'Needs Improvement',
      };

  Color get color => switch (this) {
        PerformanceBand.excellent => AppColors.emerald,
        PerformanceBand.good => AppColors.cyan,
        PerformanceBand.average => AppColors.amber,
        PerformanceBand.needsImprovement => AppColors.rose,
      };
}

/// Classifies a score [percentage] (0–100 — negative marking can push it
/// below zero, which lands in the bottom band same as any other low score).
///
/// Mirrors the thresholds the website's result page uses, so the two never
/// disagree about a label for the same attempt.
PerformanceBand performanceBandFor(num percentage) {
  if (percentage >= 85) return PerformanceBand.excellent;
  if (percentage >= 60) return PerformanceBand.good;
  if (percentage >= 40) return PerformanceBand.average;
  return PerformanceBand.needsImprovement;
}

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';

enum QuizCategoryType { free, premium }

/// Large visual card representing one of the two main quiz categories:
/// "Free Quiz" or "Premium Quiz" on the Quiz Module page.
class QuizCategoryCard extends StatelessWidget {
  const QuizCategoryCard({
    super.key,
    required this.type,
    required this.count,
    required this.onTap,
  });

  final QuizCategoryType type;
  final int count;
  final VoidCallback onTap;

  bool get _isPremium => type == QuizCategoryType.premium;

  String get _title => _isPremium ? 'Premium Quiz' : 'Free Quiz';

  String get _blurb => _isPremium
      ? 'Curated question banks with detailed explanations & solutions.'
      : 'Practice free question banks and test your speed right away.';

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final accent = _isPremium ? AppColors.amber : AppColors.emerald;
    final countLabel = Fmt.count(count, 'Quiz', 'Quizzes');

    return Semantics(
      button: true,
      // One label for the whole card. Without it a screen reader reads the
      // title, the count and the blurb as three unrelated fragments and never
      // says the card can be opened.
      label: '$_title, $countLabel',
      // Excluding the children collapses the card to a single node, which also
      // hides the InkWell's own tap action — so the action has to be restated
      // here or the card can be read but not activated.
      excludeSemantics: true,
      onTap: onTap,
      child: GlassCard(
        onTap: onTap,
        borderRadius: AppTheme.radiusLg,
        borderColor: accent.withValues(alpha: 0.35),
        // A wash of the category's own colour, so free and premium are told
        // apart by the whole card rather than by one small icon. Blended into
        // the card colour rather than layered over it, so it holds up in both
        // themes instead of washing out the surface in dark mode.
        color: Color.alphaBlend(
          accent.withValues(alpha: palette.isDark ? 0.07 : 0.045),
          palette.card,
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _IconTile(isPremium: _isPremium, accent: accent),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Wrap, not Row: at the largest text size this card allows,
                  // a fixed row of title + count overflowed the screen by a
                  // couple of hundred pixels. The count drops to its own line
                  // instead, and at ordinary sizes nothing moves.
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        _title,
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.2,
                                ),
                      ),
                      // Tinted rather than filled: the count is the answer to
                      // the second question a student asks, and a solid pill
                      // was pulling the eye ahead of the category's name.
                      AppBadge(countLabel, color: accent),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _blurb,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          // The line explaining what the category *is* was the
                          // faintest text on the screen; secondary reads as
                          // supporting copy without disappearing into the card.
                          color: palette.textSecondary,
                          height: 1.4,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _Chevron(accent: accent),
          ],
        ),
      ),
    );
  }
}

class _IconTile extends StatelessWidget {
  const _IconTile({required this.isPremium, required this.accent});

  final bool isPremium;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: isPremium
            ? AppColors.goldGradient
            : const LinearGradient(
                colors: [AppColors.emerald, AppColors.cyan],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Icon(
        isPremium ? Icons.workspace_premium_rounded : Icons.lock_open_rounded,
        color: Colors.white,
        size: 26,
      ),
    );
  }
}

/// The "opens something" affordance, in the category's colour so it belongs to
/// the card rather than looking like a neutral control dropped on top of it.
class _Chevron extends StatelessWidget {
  const _Chevron({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.13),
        shape: BoxShape.circle,
      ),
      child: Icon(Icons.chevron_right_rounded, color: accent, size: 20),
    );
  }
}

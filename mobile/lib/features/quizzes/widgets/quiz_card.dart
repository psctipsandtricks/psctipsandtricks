import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/quiz.dart';

class QuizCard extends StatelessWidget {
  const QuizCard({super.key, required this.quiz, this.onTap});

  final Quiz quiz;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final locked = quiz.isPaid && quiz.isLocked;

    return GlassCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  gradient: quiz.isLiveMock
                      ? AppColors.goldGradient
                      : AppColors.brandGradient,
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                ),
                child: Icon(
                  quiz.isLiveMock
                      ? Icons.emoji_events_rounded
                      : Icons.quiz_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  quiz.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                ),
              ),
              if (locked)
                const Icon(Icons.lock_rounded,
                    size: 17, color: AppColors.amber),
            ],
          ),
          const SizedBox(height: 13),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Meta(
                icon: Icons.help_outline_rounded,
                label: '${quiz.totalQuestions} Qs',
              ),
              _Meta(
                icon: Icons.timer_outlined,
                label: '${quiz.durationMinutes} min',
              ),
              _Meta(
                icon: Icons.military_tech_outlined,
                label: '${Fmt.marks(quiz.totalMarks)} marks',
              ),
              if (quiz.negativeMarking.enabled)
                _Meta(
                  icon: Icons.remove_circle_outline_rounded,
                  label:
                      '−${Fmt.marks(quiz.negativeMarking.deduct)}/${quiz.negativeMarking.every}',
                  color: AppColors.rose,
                ),
            ],
          ),
          const SizedBox(height: 13),
          Row(
            children: [
              if (quiz.isLiveMock)
                const AppBadge('LIVE MOCK',
                    color: AppColors.amber, icon: Icons.bolt_rounded)
              else if ((quiz.folderName ?? '').isNotEmpty)
                AppBadge(quiz.folderName!.toUpperCase()),
              const Spacer(),
              if (locked)
                Text(
                  Fmt.price(quiz.price),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppColors.amber,
                      ),
                )
              else
                Row(
                  children: [
                    Text(
                      'Start',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.cyan,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const Icon(Icons.arrow_forward_rounded,
                        size: 15, color: AppColors.cyan),
                  ],
                ),
            ],
          ),
          if (palette.isDark) const SizedBox.shrink(),
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final tint = color ?? palette.textMuted;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: tint),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tint,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

/// Folder row in the quiz hub drill-down.
class QuizFolderCard extends StatelessWidget {
  const QuizFolderCard({super.key, required this.folder, this.onTap});

  final QuizFolder folder;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final parts = <String>[
      if (folder.subFolderCount > 0)
        Fmt.count(folder.subFolderCount, 'folder'),
      if (folder.quizCount > 0) Fmt.count(folder.quizCount, 'quiz', 'quizzes'),
    ];

    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.indigo.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: const Icon(Icons.folder_rounded,
                color: AppColors.indigo, size: 19),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  folder.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                if (parts.isNotEmpty)
                  Text(
                    parts.join(' · '),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: palette.textMuted,
                        ),
                  ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: palette.textMuted),
        ],
      ),
    );
  }
}

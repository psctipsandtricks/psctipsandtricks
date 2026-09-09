import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../data/models/social_links.dart';
import 'social_icons.dart';
import 'social_media_section.dart';

/// A sleek, compact card for the Account ("Me") screen showcasing quick links
/// to all official PSC Tips & Tricks social platforms.
class SocialMediaCompactCard extends ConsumerWidget {
  const SocialMediaCompactCard({super.key});

  static Future<void> _openUrl(BuildContext context, String url, String title) async {
    HapticFeedback.lightImpact();
    final uri = Uri.parse(url);
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open $title link'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showAllChannelsModal(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        decoration: BoxDecoration(
          color: ctx.palette.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(color: ctx.palette.border, width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.35),
              blurRadius: 28,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
        child: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drag handle
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: ctx.palette.textMuted.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                const SocialMediaSection(
                  showHeader: true,
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final socialAsync = ref.watch(socialLinksProvider);
    final links = socialAsync.valueOrNull ?? SocialLinks.defaults();

    return GlassCard(
      padding: const EdgeInsets.all(16),
      borderRadius: AppTheme.radiusLg,
      accentColor: AppColors.cyan.withValues(alpha: 0.04),
      borderColor: AppColors.cyan.withValues(alpha: 0.22),
      onTap: () => _showAllChannelsModal(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: AppColors.brandGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.cyan.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(Icons.share_rounded,
                    size: 16, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Official Community & Socials',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Follow for daily PDFs, tips & live classes',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                            fontSize: 11,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  size: 18, color: palette.textMuted),
            ],
          ),
          const SizedBox(height: 14),

          // Horizontal list of interactive platform badges
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (links.youtubeUrl?.isNotEmpty == true)
                _QuickPlatformButton(
                  name: 'YouTube',
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF0000), Color(0xFFB91C1C)],
                  ),
                  icon: SocialSvgIcons.youtube(size: 16),
                  onTap: () => _openUrl(context, links.youtubeUrl!, 'YouTube'),
                ),
              if (links.telegramUrl?.isNotEmpty == true)
                _QuickPlatformButton(
                  name: 'Telegram',
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2AABEE), Color(0xFF0284C7)],
                  ),
                  icon: SocialSvgIcons.telegram(size: 16),
                  onTap: () => _openUrl(context, links.telegramUrl!, 'Telegram'),
                ),
              if (links.instagramUrl?.isNotEmpty == true)
                _QuickPlatformButton(
                  name: 'Instagram',
                  gradient: const LinearGradient(
                    colors: [Color(0xFFF58529), Color(0xFFDD2A7B)],
                  ),
                  icon: SocialSvgIcons.instagram(size: 16),
                  onTap: () => _openUrl(context, links.instagramUrl!, 'Instagram'),
                ),
              if (links.whatsappUrl?.isNotEmpty == true)
                _QuickPlatformButton(
                  name: 'WhatsApp',
                  gradient: const LinearGradient(
                    colors: [Color(0xFF25D366), Color(0xFF059669)],
                  ),
                  icon: SocialSvgIcons.whatsapp(size: 16),
                  onTap: () => _openUrl(context, links.whatsappUrl!, 'WhatsApp'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickPlatformButton extends StatelessWidget {
  const _QuickPlatformButton({
    required this.name,
    required this.gradient,
    required this.icon,
    required this.onTap,
  });

  final String name;
  final LinearGradient gradient;
  final Widget icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Column(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: gradient,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: gradient.colors.first.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Center(child: icon),
            ),
            const SizedBox(height: 5),
            Text(
              name,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

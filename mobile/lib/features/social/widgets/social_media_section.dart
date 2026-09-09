import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../data/models/social_links.dart';
import 'social_icons.dart';

class _SocialCardData {
  const _SocialCardData({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.url,
    required this.iconBuilder,
    required this.gradient,
    required this.accentColor,
  });

  final String id;
  final String title;
  final String subtitle;
  final String badge;
  final String url;
  final Widget Function({double size}) iconBuilder;
  final LinearGradient gradient;
  final Color accentColor;
}

/// A modern, attractive social media section showcasing Kerala PSC official channels.
class SocialMediaSection extends ConsumerWidget {
  const SocialMediaSection({
    super.key,
    this.showHeader = true,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  final bool showHeader;
  final EdgeInsetsGeometry padding;

  static List<_SocialCardData> _buildCards(SocialLinks links) {
    final list = <_SocialCardData>[];

    if (links.youtubeUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'youtube',
          title: 'YouTube',
          subtitle: 'Free video classes & revision lessons',
          badge: 'Classes',
          url: links.youtubeUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.youtube(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFFF0000), Color(0xFFB91C1C)],
          ),
          accentColor: const Color(0xFFEF4444),
        ),
      );
    }

    if (links.telegramUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'telegram',
          title: 'Telegram',
          subtitle: 'Daily study materials, notes & PDFs',
          badge: 'Daily PDFs',
          url: links.telegramUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.telegram(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF2AABEE), Color(0xFF0284C7)],
          ),
          accentColor: const Color(0xFF0284C7),
        ),
      );
    }

    if (links.instagramUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'instagram',
          title: 'Instagram',
          subtitle: 'Quick tips, GK facts & exam alerts',
          badge: 'Quick Tips',
          url: links.instagramUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.instagram(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF58529), Color(0xFFDD2A7B), Color(0xFF8134AF)],
          ),
          accentColor: const Color(0xFFDD2A7B),
        ),
      );
    }

    if (links.whatsappUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'whatsapp',
          title: 'WhatsApp',
          subtitle: 'Student guidance & syllabus help',
          badge: 'Support',
          url: links.whatsappUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.whatsapp(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF25D366), Color(0xFF059669)],
          ),
          accentColor: const Color(0xFF10B981),
        ),
      );
    }

    if (links.facebookUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'facebook',
          title: 'Facebook',
          subtitle: 'Community discussions & updates',
          badge: 'Community',
          url: links.facebookUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.facebook(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1877F2), Color(0xFF1D4ED8)],
          ),
          accentColor: const Color(0xFF1D4ED8),
        ),
      );
    }

    if (links.twitterUrl?.isNotEmpty == true) {
      list.add(
        _SocialCardData(
          id: 'twitter',
          title: 'X (Twitter)',
          subtitle: 'Instant exam alerts & notifications',
          badge: 'Alerts',
          url: links.twitterUrl!,
          iconBuilder: ({double size = 22}) =>
              SocialSvgIcons.twitter(size: size),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F172A), Color(0xFF334155)],
          ),
          accentColor: const Color(0xFF38BDF8),
        ),
      );
    }

    return list;
  }

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

  static void _copyUrl(BuildContext context, String url, String title) {
    HapticFeedback.mediumImpact();
    Clipboard.setData(ClipboardData(text: url));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: AppColors.cyan.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded,
                color: AppColors.cyan, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '$title link copied to clipboard',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final socialAsync = ref.watch(socialLinksProvider);
    final links = socialAsync.valueOrNull ?? SocialLinks.defaults();
    final cards = _buildCards(links);

    if (cards.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showHeader) ...[
            const SectionHeader(
              title: 'Join our community',
              subtitle: 'Daily study materials, video lessons & PSC alerts',
              icon: Icons.hub_rounded,
              iconColor: AppColors.cyan,
              padding: EdgeInsets.zero,
            ),
            const SizedBox(height: 14),
          ],

          // Grid of modern platform cards
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 580;
              final crossAxisCount = isWide ? 4 : 2;
              const spacing = 12.0;

              return GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: crossAxisCount,
                  mainAxisSpacing: spacing,
                  crossAxisSpacing: spacing,
                  childAspectRatio: isWide
                      ? (constraints.maxWidth > 900 ? 1.32 : 1.18)
                      : 1.20,
                ),
                itemCount: cards.length,
                itemBuilder: (context, index) {
                  final card = cards[index];
                  return _SocialCardItem(
                    card: card,
                    onTap: () => _openUrl(context, card.url, card.title),
                    onLongPress: () => _copyUrl(context, card.url, card.title),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SocialCardItem extends StatelessWidget {
  const _SocialCardItem({
    required this.card,
    required this.onTap,
    required this.onLongPress,
  });

  final _SocialCardData card;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return GlassCard(
      onTap: onTap,
      onLongPress: onLongPress,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      borderRadius: AppTheme.radiusLg,
      borderColor: card.accentColor.withValues(alpha: 0.25),
      accentColor: card.accentColor.withValues(alpha: 0.05),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top Row: Brand Icon with vibrant gradient tile + External Arrow
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 38,
                height: 38,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: card.gradient,
                  borderRadius: BorderRadius.circular(11),
                  boxShadow: [
                    BoxShadow(
                      color: card.accentColor.withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Center(
                  child: card.iconBuilder(size: 19),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                decoration: BoxDecoration(
                  color: card.accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: card.accentColor.withValues(alpha: 0.28),
                    width: 0.8,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      card.badge,
                      style: TextStyle(
                        color: card.accentColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(
                      Icons.arrow_outward_rounded,
                      size: 11,
                      color: card.accentColor,
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Bottom Content: Title and Subtitle
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                card.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                card.subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: palette.textSecondary,
                      height: 1.20,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

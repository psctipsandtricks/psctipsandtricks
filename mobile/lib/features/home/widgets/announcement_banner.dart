import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_image.dart';
import '../../../data/models/notification.dart';
import '../home_providers.dart';

/// The scheduled announcement popup, shown once per announcement.
///
/// Dismissal is remembered by id so a student who has closed a notice does not
/// meet it again on every app launch, which is how the website behaves.
class AnnouncementBanner extends ConsumerStatefulWidget {
  const AnnouncementBanner({super.key});

  @override
  ConsumerState<AnnouncementBanner> createState() => _AnnouncementBannerState();
}

class _AnnouncementBannerState extends ConsumerState<AnnouncementBanner> {
  static const _dismissedKey = 'psc_dismissed_announcements';

  Set<String> get _dismissed =>
      ref.read(sharedPrefsProvider).getStringList(_dismissedKey)?.toSet() ??
      <String>{};

  Future<void> _dismiss(String id) async {
    final updated = _dismissed..add(id);
    await ref
        .read(sharedPrefsProvider)
        .setStringList(_dismissedKey, updated.toList());
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final asyncAnnouncements = ref.watch(activeAnnouncementsProvider);

    return asyncAnnouncements.maybeWhen(
      data: (announcements) {
        final dismissed = _dismissed;
        final pending =
            announcements.where((a) => !dismissed.contains(a.id)).toList();

        if (pending.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Column(
            children: [
              for (final announcement in pending.take(2))
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _Banner(
                    announcement: announcement,
                    onDismiss: () => _dismiss(announcement.id),
                  ),
                ),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.announcement, required this.onDismiss});

  final AnnouncementPopup announcement;
  final VoidCallback onDismiss;

  void _handleRedirect(BuildContext context) {
    final url = announcement.redirectUrl?.trim() ?? '';
    if (url.isEmpty) return;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } else {
      context.push(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final hasButton = (announcement.buttonText ?? '').isNotEmpty &&
        (announcement.redirectUrl ?? '').isNotEmpty;

    final customColorHex = announcement.backgroundColor?.trim();
    Color? customColor;
    if (customColorHex != null && customColorHex.startsWith('#')) {
      final clean = customColorHex.replaceFirst('#', '');
      if (clean.length == 6) {
        customColor = Color(int.parse('0xFF$clean'));
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: customColor?.withValues(alpha: 0.12) ?? AppColors.amber.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: customColor?.withValues(alpha: 0.40) ?? AppColors.amber.withValues(alpha: 0.30),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if ((announcement.imageUrl ?? '').isNotEmpty)
            AppImage(
              url: announcement.imageUrl,
              height: 132,
              fallbackIcon: Icons.campaign_rounded,
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.campaign_rounded,
                    size: 18, color: AppColors.amber),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        announcement.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              height: 1.3,
                            ),
                      ),
                      if (announcement.message.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          announcement.message,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: palette.textSecondary,
                                    height: 1.5,
                                  ),
                        ),
                      ],
                      if (hasButton) ...[
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.amber,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusSm),
                            ),
                          ),
                          onPressed: () => _handleRedirect(context),
                          icon: const Icon(Icons.arrow_forward_rounded, size: 14),
                          label: Text(
                            announcement.buttonText!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Dismiss',
                  icon: const Icon(Icons.close_rounded, size: 17),
                  onPressed: onDismiss,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/providers/theme_controller.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/responsive.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../shell/shell_scaffold.dart';
import '../social/widgets/social_media_compact_card.dart';

/// The "Me" tab: identity, everything that hangs off the account, and settings.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final user = auth.user;

    return Scaffold(
      appBar: const GlassAppBar(title: Text('Me')),
      body: Responsive.centered(
        maxWidth: Responsive.maxReadingWidth,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
              Responsive.horizontalPadding(context),
              8,
              Responsive.horizontalPadding(context),
              28 + ShellScaffold.dockExtent),
          children: [
            if (user == null)
              const _SignedOutCard()
            else
              GlassCard(
                onTap: () => context.push(AppRoutes.profile),
                padding: EdgeInsets.zero,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                  child: Stack(
                    children: [
                      // A soft brand-colour bloom behind the avatar — the same
                      // ambient glow the sign-in screen opens with, so the one
                      // card every student sees most often still feels designed
                      // rather than a plain settings row.
                      Positioned(
                        top: -30,
                        left: -30,
                        child: IgnorePointer(
                          child: Container(
                            width: 130,
                            height: 130,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  AppColors.cyan.withValues(alpha: 0.16),
                                  AppColors.cyan.withValues(alpha: 0),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(2.5),
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: AppColors.brandGradient,
                              ),
                              child: AppAvatar(
                                imageUrl: user.avatarUrl,
                                name: user.name,
                                size: 58,
                              ),
                            ),
                            const SizedBox(width: 15),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.2,
                                        ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    user.email,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: context.palette.textMuted,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: context.palette.elevated,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.chevron_right_rounded,
                                  size: 18, color: context.palette.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 22),
            const _Group(
              title: 'Study',
              items: [
                _Item(
                  icon: Icons.insights_rounded,
                  label: 'My progress',
                  color: AppColors.cyan,
                  route: AppRoutes.dashboard,
                ),
                _Item(
                  icon: Icons.history_rounded,
                  label: 'Quiz attempts',
                  color: AppColors.emerald,
                  route: AppRoutes.quizHistory,
                ),
                _Item(
                  icon: Icons.emoji_events_rounded,
                  label: 'Mock tests',
                  color: AppColors.amber,
                  route: AppRoutes.mockTests,
                ),
                _Item(
                  icon: Icons.forum_rounded,
                  label: 'Community',
                  color: AppColors.indigo,
                  route: AppRoutes.community,
                ),
              ],
            ),

            const SizedBox(height: 14),
            const _Group(
              title: 'Account',
              items: [
                _Item(
                  icon: Icons.download_for_offline_rounded,
                  label: 'Downloaded books',
                  color: AppColors.cyan,
                  route: AppRoutes.downloads,
                ),
                _Item(
                  icon: Icons.receipt_long_rounded,
                  label: 'My orders',
                  color: AppColors.emerald,
                  route: AppRoutes.orders,
                ),
                _Item(
                  icon: Icons.notifications_rounded,
                  label: 'Notifications',
                  color: AppColors.sky,
                  route: AppRoutes.notifications,
                ),
                _Item(
                  icon: Icons.person_rounded,
                  label: 'Edit profile',
                  color: AppColors.blue,
                  route: AppRoutes.profile,
                ),
              ],
            ),

            const SizedBox(height: 14),
            const _AppearanceCard(),

            const SizedBox(height: 14),
            const SocialMediaCompactCard(),

            const SizedBox(height: 14),
            GlassCard(
              padding: EdgeInsets.zero,
              child: _Row(
                icon: Icons.support_agent_rounded,
                label: 'Contact support',
                color: AppColors.emerald,
                onTap: () => launchUrl(
                  Uri.parse(AppConfig.supportWhatsApp),
                  mode: LaunchMode.externalApplication,
                ),
              ),
            ),

            // Kept apart from the rest of the list, in its own rose-tinted
            // card: an action that ends the session reads as a decision, not
            // one more row to scroll past.
            if (user != null) ...[
              const SizedBox(height: 14),
              GlassCard(
                padding: EdgeInsets.zero,
                accentColor: AppColors.rose.withValues(alpha: 0.05),
                borderColor: AppColors.rose.withValues(alpha: 0.30),
                onTap: () => _confirmSignOut(context, ref),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: const BoxDecoration(
                          color: AppColors.rose,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.logout_rounded,
                            size: 16, color: Colors.white),
                      ),
                      const SizedBox(width: 13),
                      Text(
                        'Sign out',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.rose,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            const SizedBox(height: 20),
            Center(
              child: Text(
                '${AppConfig.appName} · Student app',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: context.palette.textMuted,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final ok = await showGlassConfirm(
      context,
      title: 'Sign out?',
      message: 'Your progress stays saved to your account and will be there '
          'when you sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
      icon: Icons.logout_rounded,
    );
    if (!ok) return;
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) context.go(AppRoutes.home);
  }
}

class _SignedOutCard extends StatelessWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: const BoxDecoration(
              gradient: AppColors.brandGradient,
              shape: BoxShape.circle,
            ),
            child:
                const Icon(Icons.person_rounded, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 16),
          Text(
            'Sign in to track your progress',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'Save reading progress, keep your attempt history and climb the rank list.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.palette.textSecondary,
                  height: 1.55,
                ),
          ),
          const SizedBox(height: 18),
          GradientButton(
            label: 'Sign in or create an account',
            icon: Icons.login_rounded,
            onPressed: () => context.push(AppRoutes.login),
          ),
        ],
      ),
    );
  }
}

class _Item {
  const _Item({
    required this.icon,
    required this.label,
    required this.color,
    required this.route,
  });

  final IconData icon;
  final String label;
  final Color color;
  final String route;
}

class _Group extends ConsumerWidget {
  const _Group({required this.title, required this.items});

  final String title;
  final List<_Item> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 9),
          child: Text(
            title.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: context.palette.textMuted,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
          ),
        ),
        GlassCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) Divider(height: 1, color: context.palette.border),
                _Row(
                  icon: items[i].icon,
                  label: items[i].label,
                  color: items[i].color,
                  onTap: () {
                    final signedIn =
                        ref.read(authControllerProvider).isAuthenticated;
                    final route = items[i].route;
                    context.push(
                      signedIn
                          ? route
                          : '${AppRoutes.login}?redirect=${Uri.encodeComponent(route)}',
                    );
                  },
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.22),
                    color.withValues(alpha: 0.10),
                  ],
                ),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: color.withValues(alpha: 0.18)),
              ),
              child: Icon(icon, size: 17, color: color),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                size: 19, color: context.palette.textMuted),
          ],
        ),
      ),
    );
  }
}

class _AppearanceCard extends ConsumerWidget {
  const _AppearanceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeControllerProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 9),
          child: Text(
            'APPEARANCE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: context.palette.textMuted,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
          ),
        ),
        GlassCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              for (final option in const [
                (ThemeMode.system, 'System', Icons.brightness_auto_rounded),
                (ThemeMode.light, 'Light', Icons.light_mode_rounded),
                (ThemeMode.dark, 'Dark', Icons.dark_mode_rounded),
              ])
                Expanded(
                  child: GestureDetector(
                    onTap: () => ref
                        .read(themeControllerProvider.notifier)
                        .set(option.$1),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      decoration: BoxDecoration(
                        gradient:
                            mode == option.$1 ? AppColors.brandGradient : null,
                        color:
                            mode == option.$1 ? null : context.palette.elevated,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            option.$3,
                            size: 17,
                            color: mode == option.$1
                                ? Colors.white
                                : context.palette.textSecondary,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            option.$2,
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: mode == option.$1
                                      ? Colors.white
                                      : context.palette.textSecondary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

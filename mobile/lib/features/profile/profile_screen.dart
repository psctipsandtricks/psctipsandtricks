import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/network/api_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/app_image.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/liquid_glass.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/state_views.dart';
import 'profile_providers.dart';
import '../shell/shell_scaffold.dart';

/// Edit the student's own profile: display name, phone and avatar.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();

  bool _seeded = false;
  bool _saving = false;
  bool _uploading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  /// Fills the form once, the first time real data arrives — refetches must not
  /// clobber edits the student is in the middle of typing.
  void _seed(String name, String? phone) {
    if (_seeded) return;
    _seeded = true;
    _name.text = name;
    _phone.text = phone ?? '';
  }

  Future<void> _save(String userId) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final profile = await ref.read(authRepositoryProvider).updateProfile(
            userId,
            name: _name.text.trim(),
            phoneNumber: _phone.text.trim(),
          );
      await ref.read(authControllerProvider.notifier).applyUser(profile.user);
      ref.invalidate(myProfileProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                color: AppColors.cyan.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: AppColors.emerald, size: 20),
                SizedBox(width: 10),
                Text(
                  'Profile updated successfully',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _changeAvatar(String userId) async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 85,
    );
    if (picked == null) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final profile = await ref
          .read(authRepositoryProvider)
          .uploadAvatar(userId, picked.path);
      await ref.read(authControllerProvider.notifier).applyUser(profile.user);
      ref.invalidate(myProfileProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _removeAvatar(String userId) async {
    setState(() => _uploading = true);
    try {
      final profile =
          await ref.read(authRepositoryProvider).removeAvatar(userId);
      await ref.read(authControllerProvider.notifier).applyUser(profile.user);
      ref.invalidate(myProfileProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);
    final palette = context.palette;
    final isDark = palette.isDark;

    return Scaffold(
      appBar: const GlassAppBar(title: Text('My profile')),
      body: AsyncView(
        value: profileAsync,
        onRetry: () => ref.invalidate(myProfileProvider),
        data: (profile) {
          _seed(profile.user.name, profile.user.phoneNumber);
          final user = profile.user;

          return ListView(
            padding: const EdgeInsets.fromLTRB(
                16, 16, 16, 32 + ShellScaffold.dockExtent),
            children: [
              // 1. Hero Profile Card with glowing avatar and tier badge
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? [
                            const Color(0xFF1E293B).withValues(alpha: 0.95),
                            const Color(0xFF0F172A).withValues(alpha: 0.98),
                          ]
                        : [
                            Colors.white,
                            const Color(0xFFF8FAFC),
                          ],
                  ),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.12)
                        : const Color(0xFFE2E8F0),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Stack(
                    children: [
                      // Subtle ambient glow in top corner
                      Positioned(
                        top: -40,
                        right: -40,
                        child: Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [
                                AppColors.cyan.withValues(alpha: isDark ? 0.18 : 0.10),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: -30,
                        left: -30,
                        child: Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [
                                const Color(0xFF6366F1).withValues(alpha: isDark ? 0.15 : 0.08),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Glowing avatar with interactive camera badge
                            Center(
                              child: Stack(
                                alignment: Alignment.center,
                                clipBehavior: Clip.none,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(3.5),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      gradient: LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: user.isPremium
                                            ? const [
                                                Color(0xFFFBBF24),
                                                Color(0xFFF59E0B),
                                                Color(0xFFD97706),
                                              ]
                                            : const [
                                                AppColors.cyan,
                                                Color(0xFF6366F1),
                                                Color(0xFF3B82F6),
                                              ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: (user.isPremium
                                                  ? const Color(0xFFF59E0B)
                                                  : AppColors.cyan)
                                              .withValues(alpha: 0.35),
                                          blurRadius: 16,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: AppAvatar(
                                      imageUrl: profile.displayAvatar,
                                      name: user.name,
                                      size: 96,
                                    ),
                                  ),
                                  if (_uploading)
                                    Positioned.fill(
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          color: Colors.black54,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Center(
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.8,
                                            valueColor:
                                                AlwaysStoppedAnimation<Color>(Colors.white),
                                          ),
                                        ),
                                      ),
                                    ),
                                  // Camera action badge
                                  Positioned(
                                    right: -2,
                                    bottom: -2,
                                    child: Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        onTap: _uploading ? null : () => _changeAvatar(user.id),
                                        borderRadius: BorderRadius.circular(999),
                                        child: Container(
                                          padding: const EdgeInsets.all(7.5),
                                          decoration: BoxDecoration(
                                            gradient: const LinearGradient(
                                              colors: [
                                                AppColors.cyan,
                                                Color(0xFF0284C7),
                                              ],
                                            ),
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: isDark
                                                  ? const Color(0xFF0F172A)
                                                  : Colors.white,
                                              width: 2.5,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: AppColors.cyan.withValues(alpha: 0.45),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: const Icon(
                                            Icons.camera_alt_rounded,
                                            size: 15,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),

                            // User Name
                            Text(
                              user.name,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 22,
                                    letterSpacing: -0.4,
                                  ),
                            ),
                            const SizedBox(height: 4),

                            // User Email
                            Text(
                              user.email,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: palette.textMuted,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                            ),
                            const SizedBox(height: 12),

                            // Student Status / Role Pill Badge
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4.5),
                                  decoration: BoxDecoration(
                                    gradient: user.isPremium
                                        ? const LinearGradient(
                                            colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                                          )
                                        : null,
                                    color: user.isPremium
                                        ? null
                                        : AppColors.cyan.withValues(alpha: isDark ? 0.14 : 0.09),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: user.isPremium
                                          ? const Color(0xFFF59E0B)
                                          : AppColors.cyan.withValues(alpha: 0.35),
                                      width: 0.8,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        user.isPremium
                                            ? Icons.workspace_premium_rounded
                                            : Icons.school_rounded,
                                        size: 12.5,
                                        color: user.isPremium
                                            ? const Color(0xFF0F172A)
                                            : (isDark ? AppColors.cyan : const Color(0xFF0284C7)),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        user.isPremium
                                            ? 'PREMIUM MEMBER'
                                            : 'STUDENT ACCOUNT',
                                        style: TextStyle(
                                          color: user.isPremium
                                              ? const Color(0xFF0F172A)
                                              : (isDark
                                                  ? AppColors.cyan
                                                  : const Color(0xFF0284C7)),
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: 0.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),

                            // Remove photo button if custom avatar is present
                            if (user.avatarUrl != null) ...[
                              const SizedBox(height: 10),
                              TextButton.icon(
                                onPressed: _uploading ? null : () => _removeAvatar(user.id),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 4),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                icon: Icon(
                                  Icons.delete_outline_rounded,
                                  size: 14,
                                  color: AppColors.rose.withValues(alpha: 0.85),
                                ),
                                label: Text(
                                  'Remove custom photo',
                                  style: TextStyle(
                                    color: AppColors.rose.withValues(alpha: 0.85),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // 2. Activity Statistics Cards
              const SectionHeader(
                title: 'Activity',
                subtitle: 'Your quizzes and learning progress at a glance',
                icon: Icons.query_stats_rounded,
                padding: EdgeInsets.only(bottom: 12),
              ),
              Row(
                children: [
                  Expanded(
                    child: _EnhancedStatCard(
                      label: 'Quiz attempts',
                      sublabel: 'Tests taken',
                      value: '${profile.quizAttemptsCount}',
                      icon: Icons.assignment_turned_in_rounded,
                      accentColor: AppColors.cyan,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _EnhancedStatCard(
                      label: 'Purchases',
                      sublabel: 'Active items',
                      value: '${profile.ordersCount}',
                      icon: Icons.shopping_bag_rounded,
                      accentColor: AppColors.emerald,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.rose.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(
                      color: AppColors.rose.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppColors.rose, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.rose,
                                fontWeight: FontWeight.w600,
                                height: 1.35,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
              ],

              // 3. Account Details Editable Form
              const SectionHeader(
                title: 'Account details',
                subtitle: 'Update your display name or phone number',
                icon: Icons.badge_outlined,
                padding: EdgeInsets.only(bottom: 12),
              ),
              Form(
                key: _formKey,
                child: GlassCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ProfileInputField(
                        controller: _name,
                        label: 'Full name',
                        hintText: 'Enter your name',
                        icon: Icons.person_rounded,
                        textCapitalization: TextCapitalization.words,
                        validator: (value) {
                          final v = value?.trim() ?? '';
                          if (v.isEmpty) return 'Enter your name';
                          if (v.length < 2) return 'That name looks too short';
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      _ProfileInputField(
                        controller: _phone,
                        label: 'Phone number',
                        hintText: 'e.g. +91 9876543210 (Optional)',
                        icon: Icons.phone_rounded,
                        keyboardType: TextInputType.phone,
                        validator: (value) {
                          final v = value?.trim() ?? '';
                          if (v.isEmpty) return null;
                          if (!RegExp(r'^[0-9+\-\s()]{7,16}$').hasMatch(v)) {
                            return 'Enter a valid phone number';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 26),

              // 4. Security & Sign-in Info
              const SectionHeader(
                title: 'Security & sign-in',
                subtitle: 'Identity and authentication credentials',
                icon: Icons.shield_outlined,
                padding: EdgeInsets.only(bottom: 12),
              ),
              GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(
                  children: [
                    _SecurityRow(
                      label: 'Primary email',
                      value: user.email,
                      icon: Icons.alternate_email_rounded,
                      badge: 'VERIFIED',
                      badgeColor: AppColors.emerald,
                    ),
                    const Divider(height: 1, indent: 44),
                    _SecurityRow(
                      label: 'Sign-in method',
                      value: profile.loginMethod,
                      icon: Icons.key_rounded,
                      badge: 'ACTIVE',
                      badgeColor: AppColors.cyan,
                    ),
                    if (user.createdAt != null) ...[
                      const Divider(height: 1, indent: 44),
                      _SecurityRow(
                        label: 'Member since',
                        value: Fmt.date(user.createdAt),
                        icon: Icons.calendar_today_rounded,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // 5. Save Changes Action Button
              GradientButton(
                label: 'Save changes',
                icon: Icons.check_circle_rounded,
                isLoading: _saving,
                gradient: AppColors.brandGradient,
                onPressed: _saving ? null : () => _save(user.id),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Rich interactive activity stat card with ambient glow and icon squircle.
class _EnhancedStatCard extends StatelessWidget {
  const _EnhancedStatCard({
    required this.label,
    required this.sublabel,
    required this.value,
    required this.icon,
    required this.accentColor,
  });

  final String label;
  final String sublabel;
  final String value;
  final IconData icon;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: isDark
            ? const Color(0xFF1E293B).withValues(alpha: 0.70)
            : Colors.white,
        border: Border.all(
          color: accentColor.withValues(alpha: isDark ? 0.25 : 0.20),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: isDark ? 0.08 : 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accentColor.withValues(alpha: 0.22),
                      accentColor.withValues(alpha: 0.10),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.35),
                    width: 0.8,
                  ),
                ),
                child: Icon(icon, size: 18, color: accentColor),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  sublabel.toUpperCase(),
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  fontSize: 26,
                  height: 1.0,
                  letterSpacing: -0.5,
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: palette.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

/// Custom styled input field with rounded squircle prefix and smooth focus styling.
class _ProfileInputField extends StatelessWidget {
  const _ProfileInputField({
    required this.controller,
    required this.label,
    required this.hintText,
    required this.icon,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569),
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.1,
          ),
        ),
        const SizedBox(height: 7),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF0F172A),
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: TextStyle(
              color: palette.textMuted.withValues(alpha: 0.6),
              fontSize: 13.5,
              fontWeight: FontWeight.w400,
            ),
            filled: true,
            fillColor: isDark
                ? const Color(0xFF0F172A).withValues(alpha: 0.65)
                : const Color(0xFFF1F5F9),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            prefixIcon: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.cyan.withValues(alpha: isDark ? 0.14 : 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  icon,
                  size: 16,
                  color: isDark ? AppColors.cyan : const Color(0xFF0284C7),
                ),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.10)
                    : const Color(0xFFE2E8F0),
                width: 1,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: AppColors.cyan,
                width: 1.5,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: AppColors.rose,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: AppColors.rose,
                width: 1.5,
              ),
            ),
          ),
          validator: validator,
        ),
      ],
    );
  }
}

/// Unified security and linked identity tile with key-value information and lock icon.
class _SecurityRow extends StatelessWidget {
  const _SecurityRow({
    required this.label,
    required this.value,
    required this.icon,
    this.badge,
    this.badgeColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? badge;
  final Color? badgeColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final isDark = palette.isDark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFF1E293B)
                  : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: palette.textMuted),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: palette.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          if (badge != null && badgeColor != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: badgeColor!.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: badgeColor!.withValues(alpha: 0.3),
                  width: 0.8,
                ),
              ),
              child: Text(
                badge!,
                style: TextStyle(
                  color: badgeColor!,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.3,
                ),
              ),
            ),
            const SizedBox(width: 6),
          ],
          Icon(Icons.lock_rounded, size: 13, color: palette.textMuted.withValues(alpha: 0.6)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
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
import '../../core/widgets/state_views.dart';
import 'profile_providers.dart';

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
          const SnackBar(content: Text('Profile updated')),
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
      // Avatars render at 100px at most; uploading a 12MP original wastes the
      // student's data and the server's storage.
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

    return Scaffold(
      appBar: AppBar(title: const Text('My profile')),
      body: AsyncView(
        value: profileAsync,
        onRetry: () => ref.invalidate(myProfileProvider),
        data: (profile) {
          _seed(profile.user.name, profile.user.phoneNumber);
          final user = profile.user;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              Center(
                child: Stack(
                  children: [
                    AppAvatar(
                      imageUrl: profile.displayAvatar,
                      name: user.name,
                      size: 96,
                    ),
                    if (_uploading)
                      const Positioned.fill(
                        child: CircleAvatar(
                          backgroundColor: Colors.black54,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        ),
                      ),
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Material(
                        color: AppColors.cyan,
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _uploading ? null : () => _changeAvatar(user.id),
                          child: const Padding(
                            padding: EdgeInsets.all(7),
                            child: Icon(Icons.camera_alt_rounded,
                                size: 15, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (user.avatarUrl != null) ...[
                const SizedBox(height: 6),
                Center(
                  child: TextButton(
                    onPressed: _uploading ? null : () => _removeAvatar(user.id),
                    child: Text(
                      'Remove photo',
                      style: TextStyle(color: palette.textMuted, fontSize: 12),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _Stat(
                      label: 'Quiz attempts',
                      value: '${profile.quizAttemptsCount}',
                      icon: Icons.assignment_turned_in_rounded,
                      color: AppColors.cyan,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Stat(
                      label: 'Purchases',
                      value: '${profile.ordersCount}',
                      icon: Icons.receipt_long_rounded,
                      color: AppColors.emerald,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.rose.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(
                        color: AppColors.rose.withValues(alpha: 0.32)),
                  ),
                  child: Text(
                    _error!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.rose,
                          height: 1.4,
                        ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                        prefixIcon:
                            Icon(Icons.person_outline_rounded, size: 20),
                      ),
                      validator: (value) {
                        final v = value?.trim() ?? '';
                        if (v.isEmpty) return 'Enter your name';
                        if (v.length < 2) return 'That name looks too short';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Phone number',
                        hintText: 'Optional',
                        prefixIcon: Icon(Icons.phone_outlined, size: 20),
                      ),
                      validator: (value) {
                        final v = value?.trim() ?? '';
                        if (v.isEmpty) return null;
                        if (!RegExp(r'^[0-9+\-\s()]{7,16}$').hasMatch(v)) {
                          return 'Enter a valid phone number';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Email and sign-in method are set by the identity provider
                    // and cannot be edited here.
                    _ReadOnlyField(
                      label: 'Email',
                      value: user.email,
                      icon: Icons.alternate_email_rounded,
                    ),
                    const SizedBox(height: 12),
                    _ReadOnlyField(
                      label: 'Sign-in method',
                      value: profile.loginMethod,
                      icon: Icons.verified_user_outlined,
                    ),
                    if (user.createdAt != null) ...[
                      const SizedBox(height: 12),
                      _ReadOnlyField(
                        label: 'Member since',
                        value: Fmt.date(user.createdAt),
                        icon: Icons.event_available_rounded,
                      ),
                    ],
                    const SizedBox(height: 24),
                    GradientButton(
                      label: 'Save changes',
                      icon: Icons.check_rounded,
                      isLoading: _saving,
                      onPressed: _saving ? null : () => _save(user.id),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 15),
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 7),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: context.palette.textMuted,
                ),
          ),
        ],
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: palette.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 19, color: palette.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: palette.textMuted,
                      ),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
          Icon(Icons.lock_outline_rounded, size: 15, color: palette.textMuted),
        ],
      ),
    );
  }
}

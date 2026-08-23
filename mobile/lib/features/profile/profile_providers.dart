import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/user.dart';

/// The signed-in student's full profile, including the counters and linked
/// identities that `/auth/me` does not carry.
final myProfileProvider = FutureProvider.autoDispose<UserProfile>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) throw StateError('Not signed in');
  return ref.watch(authRepositoryProvider).fetchProfile(user.id);
});

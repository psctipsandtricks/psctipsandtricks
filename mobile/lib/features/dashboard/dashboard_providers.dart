import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/dashboard.dart';

/// The student's study analytics. Bound to the session so signing out (or in
/// as somebody else) can never leave the previous student's figures on screen.
final dashboardProvider =
    FutureProvider.autoDispose<StudentDashboard>((ref) async {
  ref.keepAlive();
  final user = ref.watch(currentUserProvider);
  if (user == null) {
    throw StateError('Sign in to see your dashboard');
  }
  return ref.watch(dashboardRepositoryProvider).fetchDashboard();
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter/foundation.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/repositories/notifications_repository.dart';

/// Notifications this student has opened on this device.
///
/// The server can only remember `isRead` for a notification addressed to one
/// student. A broadcast is a single row shared by everyone, so marking it read
/// there would mark it read for the whole school — those are remembered here
/// instead, keyed by student so a shared phone does not leak one reader's state
/// into another's list.
///
/// Read state from both sources is merged when the list is built, so a targeted
/// notification read on another device still shows as read here.
class ReadNotificationsController extends StateNotifier<Set<String>> {
  ReadNotificationsController(this._prefs, this._userId, this._repository)
      : super(_prefs.getStringList(_keyFor(_userId))?.toSet() ?? <String>{});

  final SharedPreferences _prefs;
  final String? _userId;
  final NotificationsRepository _repository;

  static String _keyFor(String? userId) =>
      'psc_read_notifications_${userId ?? 'guest'}';

  /// Ids are only useful while the notification is still being listed, and the
  /// API returns a bounded window — there is no reason to grow this forever.
  static const _maxRemembered = 300;

  bool contains(String id) => state.contains(id);

  /// The single way anything in the app marks a notification read: it records
  /// the id on this device — which is what the list paints from, instantly and
  /// offline — and tells the server, which persists it for a notification
  /// addressed to this student and ignores it for a broadcast.
  void markRead(String id) {
    // The server call is worth making even when this device already knows: a
    // targeted notification read here should stop being unread elsewhere.
    _repository.markRead(id).catchError((Object e) {
      // Read state is never worth interrupting anyone for.
      if (kDebugMode) debugPrint('Could not mark notification read: $e');
    });

    if (state.contains(id)) return;
    // A LinkedHashSet keeps insertion order, so trimming drops the oldest ids.
    final ids = [...state, id];
    final kept = ids.length > _maxRemembered
        ? ids.sublist(ids.length - _maxRemembered)
        : ids;
    state = kept.toSet();
    _prefs.setStringList(_keyFor(_userId), kept);
  }
}

final readNotificationsProvider =
    StateNotifierProvider<ReadNotificationsController, Set<String>>((ref) {
  // Rebuilt when the session changes, so signing in swaps to that student's
  // read state rather than carrying the previous one over.
  final userId = ref.watch(authControllerProvider).user?.id;
  return ReadNotificationsController(
    ref.watch(sharedPrefsProvider),
    userId,
    ref.watch(notificationsRepositoryProvider),
  );
});

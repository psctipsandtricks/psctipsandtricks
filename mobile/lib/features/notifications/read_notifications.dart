import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:flutter/foundation.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/repositories/notifications_repository.dart';

/// Notifications this student has opened on this device.
///
/// The server is the shared record — it keeps a read receipt per student, for
/// broadcasts as well as for notices addressed to one student, so what is read
/// on the website comes back read here. This local set is what paints the
/// change the instant it is tapped and what carries the list offline, and it is
/// keyed by student so a shared phone does not leak one reader's state into
/// another's list.
///
/// Read state from both sources is merged when the list is built.
class ReadNotificationsController extends StateNotifier<Set<String>> {
  ReadNotificationsController(this._prefs, this._userId, this._repository)
      : super(_prefs.getStringList(_keyFor(_userId))?.toSet() ?? <String>{}) {
    _uploadExistingReads();
  }

  final SharedPreferences _prefs;
  final String? _userId;
  final NotificationsRepository _repository;

  static String _keyFor(String? userId) =>
      'psc_read_notifications_${userId ?? 'guest'}';

  static String _syncedKeyFor(String? userId) =>
      'psc_read_notifications_synced_${userId ?? 'guest'}';

  /// Ids are only useful while the notification is still being listed, and the
  /// API returns a bounded window — there is no reason to grow this forever.
  static const _maxRemembered = 300;

  bool contains(String id) => state.contains(id);

  /// The single way anything in the app marks a notification read: it records
  /// the id on this device — which is what the list paints from, instantly and
  /// offline — and tells the server, which persists it against this student so
  /// their other devices see it too.
  void markRead(String id) {
    // The server call is worth making even when this device already knows: a
    // notification read here should stop being unread elsewhere.
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

  /// Marks multiple notifications read at once, syncing the bulk receipt to the server.
  void markAllRead(Iterable<String> ids) {
    final toMark = ids.toList();
    if (toMark.isEmpty) return;

    _repository.markManyRead(toMark).catchError((Object e) {
      if (kDebugMode) debugPrint('Could not mark notifications read: $e');
    });

    final newSet = {...state, ...toMark};
    final kept = newSet.length > _maxRemembered
        ? newSet.toList().sublist(newSet.length - _maxRemembered)
        : newSet.toList();
    state = kept.toSet();
    _prefs.setStringList(_keyFor(_userId), kept);
  }

  /// Merges server-confirmed read states into local cache for offline consistency.
  void mergeServerReads(Iterable<String> serverReadIds) {
    final unmerged = serverReadIds.where((id) => !state.contains(id)).toList();
    if (unmerged.isEmpty) return;
    final newSet = {...state, ...unmerged};
    final kept = newSet.length > _maxRemembered
        ? newSet.toList().sublist(newSet.length - _maxRemembered)
        : newSet.toList();
    state = kept.toSet();
    _prefs.setStringList(_keyFor(_userId), kept);
  }

  /// Hands this device's existing read state to the server, once per student.
  ///
  /// Everything read before the server kept per-student receipts is recorded
  /// only here, so without this the synchronisation would start from an empty
  /// slate and the website would re-surface notices already dealt with on the
  /// phone. Ids the server no longer lists are ignored by it, so no filtering
  /// is needed on this side — only a cap, since its window is bounded.
  Future<void> _uploadExistingReads() async {
    if (_userId == null) return;
    final key = _syncedKeyFor(_userId);
    if (_prefs.getBool(key) ?? false) return;

    final backlog = state.toList();
    // The server's own window is bounded, so there is no point sending more
    // ids than it could still be listing.
    final recent =
        backlog.length > 100 ? backlog.sublist(backlog.length - 100) : backlog;

    try {
      await _repository.markManyRead(recent);
      await _prefs.setBool(key, true);
    } catch (e) {
      // Left unflagged, so the next launch tries again.
      if (kDebugMode) debugPrint('Could not sync read notifications: $e');
    }
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

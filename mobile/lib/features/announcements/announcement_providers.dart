import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/auth_controller.dart';
import '../../data/models/notification.dart';

/// Announcement popups currently inside their scheduled window, in the order
/// the admin panel arranged them.
///
/// Not `autoDispose`: the queue is a property of the session, not of whichever
/// screen happens to be watching it, so the list survives navigation and is
/// fetched once per app launch. Failure is silent — an announcement is never
/// important enough to put an error in front of a student.
final activeAnnouncementsProvider =
    FutureProvider<List<AnnouncementPopup>>((ref) async {
  try {
    return await ref
        .watch(notificationsRepositoryProvider)
        .fetchActiveAnnouncements();
  } catch (_) {
    return const [];
  }
});

/// Announcements the student has already dealt with — closed with the X, or
/// followed through the card's link.
///
/// Written to disk and kept: an announcement is shown once and then never
/// again, and only a newly published one (which carries a new id) comes back.
///
/// Stored per account rather than per device. Two students sharing a phone
/// each get their own announcements, and a guest who reads one and then signs
/// in is not shown it again — their guest ids are folded into the account's
/// list on the first write, rather than the account starting from nothing.
class DismissedAnnouncements extends StateNotifier<Set<String>> {
  DismissedAnnouncements(this._prefs, this._userId) : super(const <String>{}) {
    state = {..._read(_guestKey), ..._read(_key)};
  }

  static const _prefix = 'psc_seen_announcements';
  static const _guestKey = '$_prefix:guest';

  /// Ids are kept for good, so the list needs a ceiling. Trimming drops the
  /// oldest, which the server has usually stopped serving anyway.
  static const _maxRemembered = 300;

  final SharedPreferences _prefs;
  final String? _userId;

  String get _key => _userId == null ? _guestKey : '$_prefix:$_userId';

  Set<String> _read(String key) => _prefs.getStringList(key)?.toSet() ?? {};

  void dismiss(String id) {
    if (state.contains(id)) return;
    state = {...state, id};

    // Insertion order is preserved by the set literal above, so trimming the
    // front drops the ids seen longest ago.
    final kept = state.length > _maxRemembered
        ? state.toList().sublist(state.length - _maxRemembered)
        : state.toList();
    _prefs.setStringList(_key, kept);
  }
}

/// Rebuilt when the signed-in student changes, so the list is always the one
/// belonging to whoever is looking at the screen.
final dismissedAnnouncementsProvider =
    StateNotifierProvider<DismissedAnnouncements, Set<String>>((ref) {
  final userId = ref.watch(currentUserProvider.select((user) => user?.id));
  return DismissedAnnouncements(ref.watch(sharedPrefsProvider), userId);
});

/// The queue the popup walks one card at a time: active announcements the
/// student has not dismissed yet, in the order the API returned them.
final pendingAnnouncementsProvider =
    Provider<List<AnnouncementPopup>>((ref) {
  // Announcements are a signed-in feature: a guest browsing the catalogue
  // never sees one, however new or unmissed. `currentUserProvider` is null
  // both while signed out and while the stored session is still resolving —
  // exactly the two cases this should stay quiet for.
  if (ref.watch(currentUserProvider) == null) return const [];

  final active = ref.watch(activeAnnouncementsProvider).valueOrNull ?? const [];
  final dismissed = ref.watch(dismissedAnnouncementsProvider);
  return active.where((a) => !dismissed.contains(a.id)).toList();
});

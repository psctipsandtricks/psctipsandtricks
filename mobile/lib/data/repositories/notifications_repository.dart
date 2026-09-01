import '../../core/network/api_client.dart';
import '../../core/utils/json.dart';
import '../models/notification.dart';

class NotificationsRepository {
  NotificationsRepository(this._api);

  final ApiClient _api;

  Future<List<AppNotification>> fetchNotifications() async {
    final res = await _api.get<dynamic>('/notifications');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => AppNotification.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  /// Tells the API which device this installation is, so notifications aimed
  /// at one student can reach their phone.
  ///
  /// Called without a session too: the row is created unbound, re-pointed at
  /// the student when they sign in, and unbound again when they sign out.
  /// Marks one notification read.
  ///
  /// Only persists server-side for a notification addressed to this student —
  /// a broadcast row is shared by everyone, so the API leaves it alone and the
  /// app keeps its own record instead.
  Future<void> markRead(String id) async {
    await _api.patch<dynamic>('/notifications/$id/read');
  }

  Future<void> registerDevice({
    required String token,
    required String platform,
    String? appVersion,
  }) async {
    await _api.post<dynamic>('/notifications/devices', body: {
      'token': token,
      'platform': platform,
      if (appVersion != null) 'appVersion': appVersion,
    });
  }

  /// Popups currently inside their scheduled window.
  Future<List<AnnouncementPopup>> fetchActiveAnnouncements() async {
    final res = await _api.get<dynamic>('/notifications/announcements/active');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => AnnouncementPopup.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

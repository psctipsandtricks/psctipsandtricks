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

  /// Marks one notification read for this student, everywhere.
  ///
  /// Broadcasts included: the server keeps a read receipt per student rather
  /// than a flag on the shared row, so a notice read here comes back read on
  /// the website too, and one read there comes back read here.
  Future<void> markRead(String id) async {
    await _api.patch<dynamic>('/notifications/$id/read');
  }

  /// Marks several notifications read in one request.
  ///
  /// Used for handing this device's pre-existing read state to the server, so
  /// synchronisation does not start from an empty slate.
  Future<void> markManyRead(List<String> ids) async {
    if (ids.isEmpty) return;
    await _api.post<dynamic>('/notifications/read', body: {'ids': ids});
  }

  /// Tells the API which device this installation is, so notifications aimed
  /// at one student can reach their phone.
  ///
  /// Called without a session too: the row is created unbound, re-pointed at
  /// the student when they sign in, and unbound again when they sign out.
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

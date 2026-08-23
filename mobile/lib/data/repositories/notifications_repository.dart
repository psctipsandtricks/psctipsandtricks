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

  /// Popups currently inside their scheduled window.
  Future<List<AnnouncementPopup>> fetchActiveAnnouncements() async {
    final res = await _api.get<dynamic>('/notifications/announcements/active');
    return J.rows(res)
        .whereType<Map>()
        .map((e) => AnnouncementPopup.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

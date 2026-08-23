import '../../core/utils/json.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.isRead,
    this.type,
    this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final bool isRead;
  final String? type;
  final DateTime? createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: J.str(json['id']),
        title: J.str(json['title']),
        body: J.str(json['body']),
        isRead: J.boolVal(json['isRead']),
        type: J.strOrNull(json['type']),
        createdAt: J.dateOrNull(json['createdAt']),
      );
}

/// A scheduled popup the admin panel publishes to every student.
class AnnouncementPopup {
  const AnnouncementPopup({
    required this.id,
    required this.title,
    required this.message,
    this.imageUrl,
    this.buttonText,
    this.redirectUrl,
    this.backgroundColor,
    this.endDate,
  });

  final String id;
  final String title;
  final String message;
  final String? imageUrl;
  final String? buttonText;
  final String? redirectUrl;
  final String? backgroundColor;
  final DateTime? endDate;

  factory AnnouncementPopup.fromJson(Map<String, dynamic> json) =>
      AnnouncementPopup(
        id: J.str(json['id']),
        title: J.str(json['title']),
        message: J.str(json['message']),
        imageUrl: J.strOrNull(json['imageUrl']),
        buttonText: J.strOrNull(json['buttonText']),
        redirectUrl: J.strOrNull(json['redirectUrl']),
        backgroundColor: J.strOrNull(json['backgroundColor']),
        endDate: J.dateOrNull(json['endDate']),
      );
}

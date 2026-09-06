import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../features/notifications/notifications_screen.dart';
import '../../firebase_options.dart';
import '../providers/app_providers.dart';
import '../providers/auth_controller.dart';
import '../router/app_router.dart';
import '../router/notification_destination.dart';
import '../../features/notifications/read_notifications.dart';

/// The topic every installation subscribes to. The API broadcasts here rather
/// than looping over stored tokens, so a notice for everyone costs one request.
const _broadcastTopic = 'all-students';

/// The Android channel the API names in its `android.notification.channel_id`.
/// Both sides have to agree or Android 8+ files the notification under a
/// channel the student cannot configure.
const _channel = AndroidNotificationChannel(
  'psc_default',
  'Announcements',
  description: 'Exam alerts, new books and quiz announcements.',
  importance: Importance.high,
);

/// Push notifications: registration, foreground display, and tap routing.
///
/// Firebase is optional at runtime. Until `flutterfire configure` has written
/// real values into `firebase_options.dart`, [start] returns immediately and
/// the app behaves exactly as it did before — notifications are still readable
/// on the notifications screen, they just do not arrive on their own.
class PushService {
  PushService(this._ref) {
    // Re-register whenever the session changes. Signing in re-points the token
    // at that student; signing out re-registers with no bearer token, which
    // unbinds the row — so a handed-back phone stops receiving the previous
    // student's targeted notifications but still gets broadcasts.
    _ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (previous?.user?.id == next.user?.id) return;
      unawaited(_syncRegistration());
    });
  }

  final Ref _ref;
  final _local = FlutterLocalNotificationsPlugin();

  String? _token;
  bool _started = false;

  /// True once the generated Firebase options carry real project values.
  static bool get isConfigured =>
      DefaultFirebaseOptions.currentPlatform.projectId !=
      DefaultFirebaseOptions.placeholder;

  /// Brings push up. Safe to call more than once and safe to call before the
  /// student signs in — an anonymous device still receives broadcasts.
  Future<void> start() async {
    if (_started || !isConfigured) return;
    _started = true;

    try {
      await _initLocalNotifications();

      // Listen for foreground messages
      FirebaseMessaging.onMessage.listen(_showForeground);

      // Tapped from the tray while the app was in the background
      FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);

      // Check if the app was launched by tapping a push notification from terminated state
      FirebaseMessaging.instance.getInitialMessage().then((initial) {
        if (initial != null) {
          _handleTap(initial);
        }
      }).catchError((e) {
        if (kDebugMode) debugPrint('Error checking initial FCM message: $e');
      });

      // Background FCM token and permissions synchronization
      unawaited(_setupFcmRegistration());
    } catch (e) {
      // A misconfigured Firebase project, a device without Play Services, or a
      // student who declined the permission must not take the app down.
      if (kDebugMode) debugPrint('Push notifications unavailable: $e');
    }
  }

  Future<void> _setupFcmRegistration() async {
    try {
      // Asks for POST_NOTIFICATIONS on Android 13+, and does nothing on older
      // releases where the permission is granted at install time.
      await FirebaseMessaging.instance.requestPermission();

      _token = await FirebaseMessaging.instance.getToken();
      await _syncRegistration();

      // FCM rotates tokens on reinstall and on app-data clears; a device whose
      // new token was never sent up silently stops receiving anything.
      FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        _token = token;
        unawaited(_syncRegistration());
      });

      await FirebaseMessaging.instance.subscribeToTopic(_broadcastTopic);
    } catch (e) {
      if (kDebugMode) debugPrint('FCM registration setup error: $e');
    }
  }

  Future<void> _initLocalNotifications() async {
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = Map<String, dynamic>.from(
            jsonDecode(payload) as Map,
          );
          _route(data.map((k, v) => MapEntry(k, '$v')));
        } catch (_) {
          _route(const {});
        }
      },
    );

    final androidPlugin = _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_channel);
    await androidPlugin?.requestNotificationsPermission();

    // Check if the app was cold-launched from tapping a local notification
    final launchDetails = await _local.getNotificationAppLaunchDetails();
    if (launchDetails?.didNotificationLaunchApp == true &&
        launchDetails?.notificationResponse?.payload != null) {
      try {
        final data = Map<String, dynamic>.from(
          jsonDecode(launchDetails!.notificationResponse!.payload!) as Map,
        );
        _route(data.map((k, v) => MapEntry(k, '$v')));
      } catch (_) {}
    }
  }

  /// Tells the API which student, if any, this device now belongs to.
  ///
  /// Deliberately sent with whatever session is current: unauthenticated calls
  /// are valid and are how a device is released on sign-out.
  Future<void> _syncRegistration() async {
    final token = _token;
    if (token == null || token.isEmpty) return;

    try {
      final info = await PackageInfo.fromPlatform();
      await _ref.read(notificationsRepositoryProvider).registerDevice(
            token: token,
            platform: defaultTargetPlatform == TargetPlatform.iOS
                ? 'ios'
                : 'android',
            appVersion: '${info.version}+${info.buildNumber}',
          );
    } catch (e) {
      // Registration is retried on the next launch and on every token refresh;
      // failing here must not interrupt a sign-in.
      if (kDebugMode) debugPrint('Device registration failed: $e');
    }
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final imageUrl = notification.android?.imageUrl ??
        message.data['imageUrl'] as String?;

    BigPictureStyleInformation? bigPictureStyle;
    if (imageUrl != null && imageUrl.isNotEmpty) {
      try {
        final dio = Dio(BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
        ));
        final response = await dio.get<List<int>>(
          imageUrl,
          options: Options(responseType: ResponseType.bytes),
        );
        if (response.data != null && response.data!.isNotEmpty) {
          final bytes = Uint8List.fromList(response.data!);
          bigPictureStyle = BigPictureStyleInformation(
            ByteArrayAndroidBitmap(bytes),
            contentTitle: notification.title,
            summaryText: notification.body,
            hideExpandedLargeIcon: true,
          );
        }
      } catch (e) {
        if (kDebugMode) debugPrint('Could not load rich push image: $e');
      }
    }

    await _local.show(
      id: message.hashCode,
      title: notification.title,
      body: notification.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          styleInformation: bigPictureStyle,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );

    _refreshInbox();
  }

  void _handleTap(RemoteMessage message) {
    _route(message.data.map((k, v) => MapEntry(k, '$v')));
  }

  /// Sends the student directly to the exact page/link associated with the
  /// notification, or falls back to the notifications inbox if none is provided.
  void _route(Map<String, String> data) {
    _refreshInbox();

    // Opening a notification is reading it, however the app was launched.
    final notificationId = (data['notificationId'] ?? '').trim();
    if (notificationId.isNotEmpty) {
      _ref.read(readNotificationsProvider.notifier).markRead(notificationId);
    }

    // Extract target from any standard or entity payload keys
    final rawTarget = (data['route']?.trim().isNotEmpty == true ? data['route'] : null) ??
        (data['link']?.trim().isNotEmpty == true ? data['link'] : null) ??
        (data['url']?.trim().isNotEmpty == true ? data['url'] : null) ??
        (data['path']?.trim().isNotEmpty == true ? data['path'] : null) ??
        (data['destination']?.trim().isNotEmpty == true ? data['destination'] : null) ??
        (data['redirectUrl']?.trim().isNotEmpty == true ? data['redirectUrl'] : null) ??
        (data['target']?.trim().isNotEmpty == true ? data['target'] : null) ??
        (data['click_action']?.trim().isNotEmpty == true ? data['click_action'] : null) ??
        (data['bookId']?.trim().isNotEmpty == true ? '/books/${data['bookId']!.trim()}' : null) ??
        (data['quizId']?.trim().isNotEmpty == true ? '/attempt/${data['quizId']!.trim()}' : null) ??
        (data['mockTestId']?.trim().isNotEmpty == true ? '/mock-tests/${data['mockTestId']!.trim()}' : null) ??
        (data['groupId']?.trim().isNotEmpty == true ? '/community/${data['groupId']!.trim()}' : null) ??
        (data['orderId']?.trim().isNotEmpty == true ? '/orders' : null);

    final destination = resolveNotificationDestination(rawTarget);

    if (destination != null && destination.isExternal) {
      launchUrl(destination.externalUrl!, mode: LaunchMode.externalApplication);
      return;
    }

    // When an exact destination is provided, navigate directly to it;
    // only fall back to the notifications screen if no valid destination was specified.
    final target = destination?.location ?? AppRoutes.notifications;

    try {
      _ref.read(routerProvider).go(target);
    } catch (e) {
      if (kDebugMode) debugPrint('Could not navigate to $target from notification: $e');
    }
  }

  /// Drops the cached notifications list so the new message is there when the
  /// screen opens, rather than one pull-to-refresh later.
  void _refreshInbox() => _ref.invalidate(notificationsProvider);
}

final pushServiceProvider = Provider<PushService>((ref) => PushService(ref));

/// Runs in its own isolate when a message lands with the app killed or
/// backgrounded.
///
/// Android draws the tray notification itself from the message's `notification`
/// block, so there is nothing to do here — but FCM requires a registered
/// handler for background delivery to be wired up at all.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) debugPrint('Background push: ${message.messageId}');
}

/// Boots Firebase and installs the background handler.
///
/// Called from `main()` before the app runs, because a background handler
/// registered after the first frame misses a cold start opened from the tray.
/// Returns false when Firebase is not configured or refuses to start, which is
/// not an error the student ever needs to see.
Future<bool> initialiseFirebase() async {
  if (!PushService.isConfigured) return false;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    return true;
  } catch (e) {
    if (kDebugMode) debugPrint('Firebase could not start: $e');
    return false;
  }
}

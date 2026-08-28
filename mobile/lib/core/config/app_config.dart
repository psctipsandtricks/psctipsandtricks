import 'package:flutter/foundation.dart';

/// Environment configuration for the student app.
///
/// Every value can be overridden at build time without touching source, e.g.
/// `flutter build apk --dart-define=API_BASE_URL=https://api.example.com`.
class AppConfig {
  const AppConfig._();

  static const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// In debug mode on Android emulator, defaults to 10.0.2.2:4000 to connect instantly
  /// to the local backend on your computer. In release builds on real devices,
  /// defaults to the production Railway backend.
  static String get apiBaseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    if (kDebugMode) {
      return 'http://10.0.2.2:4000';
    }
    return 'https://api-production-15ff.up.railway.app';
  }

  /// Razorpay publishable key id. The server also returns a `keyId` on every
  /// created order, and that one wins — this is only the fallback.
  static const String razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
    defaultValue: '',
  );

  /// The Google *web* OAuth client id, used as the native sign-in plugin's
  /// `serverClientId` so the ID token it returns is addressed to the same
  /// client the API verifies against.
  ///
  /// Not a secret — a client id travels in every OAuth redirect and ships
  /// inside `google-services.json` — so it is baked in rather than required at
  /// build time. Override with `--dart-define=GOOGLE_SERVER_CLIENT_ID=…` for a
  /// deployment that uses a different Google project.
  static String get googleServerClientId {
    const defined = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
    if (defined.isNotEmpty) return defined;
    return '313869157607-kc569avj43psp93cq9sjltaapfgjm1lt.apps.googleusercontent.com';
  }

  /// Socket.IO endpoint for community chat. Defaults to the API host.
  static String get socketUrl {
    const defined = String.fromEnvironment('SOCKET_URL');
    if (defined.isNotEmpty) return defined;
    return apiBaseUrl;
  }

  static const String appName = 'PSC Tips & Tricks';
  static const String supportPhone = '+91 88919 30605';
  static const String supportWhatsApp = 'https://wa.me/918891930605';

  static const Duration connectTimeout = Duration(seconds: 45);
  static const Duration receiveTimeout = Duration(seconds: 60);

  /// How long a cached list response stays fresh before a background refetch.
  static const Duration defaultCacheTtl = Duration(minutes: 5);
}

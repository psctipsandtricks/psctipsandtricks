/// Environment configuration for the student app.
///
/// Every value can be overridden at build time without touching source, e.g.
/// `flutter build apk --dart-define=API_BASE_URL=https://api.example.com`.
class AppConfig {
  const AppConfig._();

  /// Base URL of the existing NestJS API. The app never talks to any other
  /// backend — books, quizzes, auth and payments all resolve against this host.
  ///
  /// The default targets the Android emulator loopback alias (10.0.2.2), which
  /// maps to the host machine's `localhost:4000` where `npm run dev` serves the
  /// API. Physical devices and release builds must pass `--dart-define`.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  /// Razorpay publishable key id. The server also returns a `keyId` on every
  /// created order, and that one wins — this is only the fallback.
  static const String razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
    defaultValue: '',
  );

  /// Socket.IO endpoint for community chat. Defaults to the API host.
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: apiBaseUrl,
  );

  static const String appName = 'PSC Tips & Tricks';
  static const String supportPhone = '+91 88919 30605';
  static const String supportWhatsApp = 'https://wa.me/918891930605';

  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// How long a cached list response stays fresh before a background refetch.
  static const Duration defaultCacheTtl = Duration(minutes: 5);
}

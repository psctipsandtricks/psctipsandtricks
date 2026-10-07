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
    return '313869157607-dg7s5u66lmiu9c5um0e5ae2s8778oire.apps.googleusercontent.com';
  }

  /// Supabase project URL and anon public key for authentication.
  static String get supabaseUrl {
    const defined = String.fromEnvironment('SUPABASE_URL');
    if (defined.isNotEmpty) return defined;
    return 'https://lgxulhrppihkzwudvmpu.supabase.co';
  }

  static String get supabaseAnonKey {
    const defined = String.fromEnvironment('SUPABASE_ANON_KEY');
    if (defined.isNotEmpty) return defined;
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxneHVsaHJwcGloa3p3dWR2bXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzIwODAsImV4cCI6MjEwMTI0ODA4MH0.KSNAGNa-sUW9aMoESMpEVTKBJGV0oItEuf6uHt17GyE';
  }

  static const String supabaseAuthCallbackUrl = 'com.psctipsandtricks://login-callback';

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

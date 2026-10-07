import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import 'google_native_sign_in.dart';

/// Raised when Supabase authentication fails.
class SupabaseAuthFailure implements Exception {
  const SupabaseAuthFailure(this.reason, {this.debugDetail, this.code});
  final String reason;
  final String? debugDetail;
  final String? code;

  @override
  String toString() =>
      'SupabaseAuthFailure: $reason${code != null ? ' [code: $code]' : ''}${debugDetail != null ? ' ($debugDetail)' : ''}';
}

/// Manages Supabase authentication:
/// - Passwordless Email Magic Link & 6-digit OTP
/// - Google OAuth Sign-In (native ID token & OAuth redirect)
class SupabaseAuthService {
  SupabaseAuthService._();

  static const _pendingEmailKey = 'auth.supabase.pendingEmail';

  static GoTrueClient get _auth => Supabase.instance.client.auth;

  static String? pendingEmail(SharedPreferences prefs) =>
      prefs.getString(_pendingEmailKey);

  static Future<void> clearPendingEmail(SharedPreferences prefs) =>
      prefs.remove(_pendingEmailKey);

  /// Sends a Supabase OTP / Magic link to the provided [email].
  static Future<void> sendOtp(String email, SharedPreferences prefs) async {
    final address = email.trim().toLowerCase();
    try {
      await _auth.signInWithOtp(
        email: address,
        emailRedirectTo: AppConfig.supabaseAuthCallbackUrl,
      );
      await prefs.setString(_pendingEmailKey, address);
    } on AuthException catch (e) {
      debugPrint('Supabase AuthException in signInWithOtp: ${e.statusCode} ${e.message} ${e.code}');
      throw SupabaseAuthFailure(
        _formatSupabaseError(e),
        code: e.code,
        debugDetail: '${e.statusCode}: ${e.message}',
      );
    } catch (e, st) {
      debugPrint('Unexpected error in signInWithOtp: $e\n$st');
      throw SupabaseAuthFailure(
        'Could not send verification email. Please try again.',
        debugDetail: e.toString(),
      );
    }
  }

  /// Verifies the 6-digit OTP code entered by the user.
  static Future<String> verifyOtpCode({
    required String email,
    required String token,
    required SharedPreferences prefs,
  }) async {
    final address = email.trim().toLowerCase();
    try {
      final res = await _auth.verifyOTP(
        email: address,
        token: token.trim(),
        type: OtpType.email,
      );
      final accessToken = res.session?.accessToken;
      if (accessToken == null || accessToken.isEmpty) {
        throw const SupabaseAuthFailure(
          'Verification succeeded but no session token was received. Please try again.',
        );
      }
      await prefs.remove(_pendingEmailKey);
      return accessToken;
    } on AuthException catch (e) {
      debugPrint('Supabase AuthException in verifyOTP: ${e.statusCode} ${e.message} ${e.code}');
      throw SupabaseAuthFailure(
        _formatSupabaseError(e),
        code: e.code,
        debugDetail: '${e.statusCode}: ${e.message}',
      );
    } catch (e, st) {
      if (e is SupabaseAuthFailure) rethrow;
      debugPrint('Unexpected error in verifyOTP: $e\n$st');
      throw SupabaseAuthFailure(
        'Could not verify OTP. Please try again.',
        debugDetail: e.toString(),
      );
    }
  }

  /// Completes sign-in when an email magic link / OAuth redirect URL arrives.
  static Future<String> getSessionFromUrl(Uri uri) async {
    try {
      final res = await _auth.getSessionFromUrl(uri);
      final accessToken = res.session.accessToken;
      if (accessToken.isEmpty) {
        throw const SupabaseAuthFailure(
          'No access token in session. Please request a new sign-in link.',
        );
      }
      return accessToken;
    } on AuthException catch (e) {
      debugPrint('Supabase AuthException in getSessionFromUrl: ${e.statusCode} ${e.message}');
      throw SupabaseAuthFailure(
        _formatSupabaseError(e),
        code: e.code,
        debugDetail: '${e.statusCode}: ${e.message}',
      );
    } catch (e) {
      if (e is SupabaseAuthFailure) rethrow;
      debugPrint('Unexpected error in getSessionFromUrl: $e');
      throw SupabaseAuthFailure(
        'Could not complete login with this link. Please try again.',
        debugDetail: e.toString(),
      );
    }
  }

  /// Signs in with Google using Supabase.
  /// First attempts native Google ID token sign-in; if unavailable,
  /// initiates Supabase OAuth redirect.
  static Future<String?> signInWithGoogle() async {
    try {
      // 1. Try native Google Sign-in to get ID token
      final tokens = await GoogleNativeSignIn.tokens();
      if (tokens != null && tokens.isValid) {
        try {
          final res = await _auth.signInWithIdToken(
            provider: OAuthProvider.google,
            idToken: tokens.idToken!,
          );
          final accessToken = res.session?.accessToken;
          if (accessToken != null && accessToken.isNotEmpty) {
            return accessToken;
          }
        } catch (e) {
          debugPrint('Supabase signInWithIdToken failed: $e, falling back to OAuth redirect');
        }
      }

      // 2. Fallback to Supabase OAuth browser flow
      final success = await _auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: AppConfig.supabaseAuthCallbackUrl,
      );
      if (!success) {
        throw const SupabaseAuthFailure(
          'Could not start Google Sign-In. Please try again.',
        );
      }
      return null;
    } on AuthException catch (e) {
      debugPrint('Supabase AuthException in signInWithGoogle: ${e.statusCode} ${e.message}');
      throw SupabaseAuthFailure(
        _formatSupabaseError(e),
        code: e.code,
        debugDetail: '${e.statusCode}: ${e.message}',
      );
    } catch (e) {
      if (e is SupabaseAuthFailure) rethrow;
      debugPrint('Google sign-in error: $e');
      throw SupabaseAuthFailure(
        'Google Sign-In failed. Please try again.',
        debugDetail: e.toString(),
      );
    }
  }

  /// Signs out of Supabase.
  static Future<void> signOut() async {
    try {
      await _auth.signOut();
    } catch (e) {
      debugPrint('Supabase signOut error: $e');
    }
  }

  /// Gets the current Supabase session access token if valid.
  static String? get currentAccessToken =>
      _auth.currentSession?.accessToken;

  static String _formatSupabaseError(AuthException e) {
    final msg = e.message.trim();
    if (msg.toLowerCase().contains('rate limit') ||
        msg.toLowerCase().contains('too many requests')) {
      return 'Too many attempts. Please wait a few moments and try again.';
    }
    if (msg.toLowerCase().contains('invalid token') ||
        msg.toLowerCase().contains('otp has expired') ||
        msg.toLowerCase().contains('token has expired')) {
      return 'The verification code or link has expired or is invalid. Please request a new one.';
    }
    return msg.isNotEmpty ? msg : 'An authentication error occurred.';
  }
}

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/app_config.dart';

/// Tokens returned by the device's native Google Sign-In flow.
class GoogleNativeTokens {
  const GoogleNativeTokens({this.idToken});
  final String? idToken;

  bool get isValid => idToken != null && idToken!.isNotEmpty;
}

/// Raised when the native flow cannot run at all.
///
/// [reason] is what the student sees — plain language with something they can
/// actually do next. [debugDetail], when present, is the raw platform
/// exception text (error codes, Play Services internals) for the developer
/// console only; it must never reach the UI.
class GoogleNativeUnavailable implements Exception {
  const GoogleNativeUnavailable(this.reason, {this.debugDetail});
  final String reason;
  final String? debugDetail;

  @override
  String toString() =>
      'GoogleNativeUnavailable: $reason${debugDetail != null ? ' ($debugDetail)' : ''}';
}

class GoogleNativeSignIn {
  GoogleNativeSignIn._();

  static GoogleSignIn? _signInInstance;

  static GoogleSignIn get _signIn {
    final serverClientId = AppConfig.googleServerClientId;
    return _signInInstance ??= GoogleSignIn(
      serverClientId: serverClientId.isNotEmpty ? serverClientId : null,
      scopes: const ['email', 'profile'],
    );
  }

  /// Returns Google tokens for the account the student picked, or null if dismissed.
  static Future<GoogleNativeTokens?> tokens() async {
    GoogleSignInAccount? account;
    try {
      account = await _signIn.signIn();
    } catch (e) {
      final errorStr = e.toString();
      if (kDebugMode) debugPrint('GoogleSignIn.signIn error: $e');
      if (errorStr.toLowerCase().contains('canceled') ||
          errorStr.toLowerCase().contains('cancelled') ||
          errorStr.toLowerCase().contains('dismissed')) {
        return null;
      }
      throw GoogleNativeUnavailable(
        'Google Sign-In isn\'t available right now. Please try again.',
        debugDetail: errorStr,
      );
    }

    if (account == null) {
      // User cancelled account picker
      return null;
    }

    try {
      final auth = await account.authentication;
      final idToken = auth.idToken;

      final result = GoogleNativeTokens(idToken: idToken);
      if (result.isValid) return result;
    } catch (e) {
      if (kDebugMode) debugPrint('Failed to get account.authentication: $e');
    }

    if (kDebugMode) {
      debugPrint('GoogleSignIn: account picked but no ID token was returned.');
    }
    throw const GoogleNativeUnavailable(
      'Google Sign-In returned no ID token. Please try again or sign in with email.',
    );
  }

  /// Backward compatible ID token helper.
  static Future<String?> idToken() async {
    final t = await tokens();
    return t?.idToken;
  }

  /// Clears cached sign-in state.
  static Future<void> signOut() async {
    try {
      await _signInInstance?.signOut();
    } catch (e) {
      if (kDebugMode) debugPrint('Google sign-out failed: $e');
    }
  }
}

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
class GoogleNativeUnavailable implements Exception {
  const GoogleNativeUnavailable(this.reason);
  final String reason;

  @override
  String toString() => 'GoogleNativeUnavailable: $reason';
}

/// The Google account picker Android already has.
class GoogleNativeSignIn {
  GoogleNativeSignIn._();

  static bool _initialised = false;

  static final _explicitUserCancel = RegExp(
    r'cancell?ed by user|user_canceled|dismissed',
    caseSensitive: false,
  );

  /// Returns Google tokens for the account the student picked, or null if dismissed.
  static Future<GoogleNativeTokens?> tokens() async {
    final serverClientId = AppConfig.googleServerClientId;
    final signIn = GoogleSignIn.instance;

    if (!_initialised) {
      try {
        if (serverClientId.isNotEmpty) {
          await signIn.initialize(serverClientId: serverClientId);
        } else {
          await signIn.initialize();
        }
        _initialised = true;
      } catch (e) {
        if (kDebugMode) debugPrint('GoogleSignIn.initialize warning: $e');
      }
    }

    GoogleSignInAccount? account;
    String? failureReason;

    if (signIn.supportsAuthenticate()) {
      try {
        account = await signIn.authenticate();
      } on GoogleSignInException catch (e) {
        final description = e.description ?? '';
        if (_explicitUserCancel.hasMatch(description)) {
          return null; // Explicit user back button / cancel
        }
        failureReason = 'Google Sign-In Error [${e.code.name}]: ${description.isNotEmpty ? description : 'Authentication failed.'}';
        if (kDebugMode) debugPrint('GoogleSignIn.authenticate failed: $failureReason');
      } catch (e) {
        failureReason = 'Google Sign-In Exception: $e';
        if (kDebugMode) debugPrint('GoogleSignIn.authenticate exception: $e');
      }
    }

    if (account == null) {
      if (failureReason != null) {
        throw GoogleNativeUnavailable(failureReason);
      }
      return null;
    }

    try {
      final auth = account.authentication;
      final idToken = auth.idToken;

      final result = GoogleNativeTokens(idToken: idToken);
      if (result.isValid) return result;
    } catch (e) {
      if (kDebugMode) debugPrint('Failed to get account.authentication: $e');
    }

    throw const GoogleNativeUnavailable('Google returned no ID token. Please verify SHA-1 in Firebase Console.');
  }

  /// Backward compatible ID token helper.
  static Future<String?> idToken() async {
    final t = await tokens();
    return t?.idToken;
  }

  /// Clears cached sign-in state.
  static Future<void> signOut() async {
    if (!_initialised) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (e) {
      if (kDebugMode) debugPrint('Google sign-out failed: $e');
    }
  }
}

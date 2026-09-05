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
    String? failureDetail;

    if (signIn.supportsAuthenticate()) {
      try {
        account = await signIn.authenticate();
      } on GoogleSignInException catch (e) {
        final description = e.description ?? '';
        if (_explicitUserCancel.hasMatch(description)) {
          return null; // Explicit user back button / cancel
        }
        failureDetail = 'GoogleSignInException(${e.code.name}): '
            '${description.isNotEmpty ? description : 'Authentication failed.'}';
        failureReason = _friendlyReason(code: e.code.name, description: description);
        if (kDebugMode) debugPrint('GoogleSignIn.authenticate failed: $failureDetail');
      } catch (e) {
        failureReason = _genericUnavailable;
        failureDetail = e.toString();
        if (kDebugMode) debugPrint('GoogleSignIn.authenticate exception: $failureDetail');
      }
    }

    if (account == null) {
      if (failureReason != null) {
        throw GoogleNativeUnavailable(failureReason, debugDetail: failureDetail);
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

    // A picked account with no ID token back is a client configuration
    // problem (SHA-1 fingerprint not registered for this signing key, or the
    // server client id not authorised) — nothing the student did wrong, and
    // nothing they can fix, so the detail goes to the debug log only.
    if (kDebugMode) {
      debugPrint(
        'GoogleSignIn: account picked but no ID token was returned. '
        'Check that this build\'s signing certificate SHA-1 is registered '
        'against the Android OAuth client in Firebase / Google Cloud Console, '
        'and that google-services.json was re-downloaded afterwards.',
      );
    }
    throw const GoogleNativeUnavailable(
      _genericUnavailable,
      debugDetail: 'No ID token returned for the picked account — check the '
          'signing certificate SHA-1 is registered against the Android OAuth '
          'client in Firebase / Google Cloud Console.',
    );
  }

  static const _genericUnavailable =
      'Google Sign-In isn\'t available right now. Please try again in a '
      'moment, or sign in with email instead.';

  /// Turns a platform sign-in failure into something a student can act on.
  /// The precise code/description is never shown here — only logged (by the
  /// caller, via kDebugMode) — because none of these are anything the student
  /// can fix by reading a Play Services error code.
  static String _friendlyReason({
    required String code,
    required String description,
  }) {
    final text = '$code $description'.toLowerCase();

    // Play Services couldn't complete the request at all — the device has no
    // synced Google account, Play Services is outdated, or (on an emulator)
    // there is no Play Store / signed-in account to offer. This is also the
    // error surfaced when the app's signing certificate isn't registered
    // against the Google OAuth client, which reads identically from here.
    if (text.contains('[16]') ||
        text.contains('api_unavailable') ||
        text.contains('reauth failed') ||
        text.contains('activity is cancelled') ||
        text.contains('no credentials available')) {
      return 'Couldn\'t reach Google Sign-In on this device. Make sure '
          'Google Play Services is up to date and a Google account is signed '
          'in under device Settings, then try again — or sign in with email.';
    }

    if (text.contains('network') || text.contains('[7]')) {
      return 'No connection to Google right now. Check your internet and '
          'try again.';
    }

    return _genericUnavailable;
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

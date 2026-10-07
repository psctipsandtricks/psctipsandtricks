import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../firebase_options.dart';

/// Raised when an email link sign-in cannot go ahead. [reason] is written for
/// the student; [debugDetail] is the raw Firebase error for the console only.
class EmailLinkFailure implements Exception {
  const EmailLinkFailure(this.reason, {this.debugDetail, this.code});
  final String reason;
  final String? debugDetail;
  final String? code;

  @override
  String toString() =>
      'EmailLinkFailure: $reason${code != null ? ' [code: $code]' : ''}${debugDetail != null ? ' ($debugDetail)' : ''}';
}

/// Passwordless sign-in through Firebase Auth email links.
///
/// Firebase only proves the student owns the address: [complete] hands back a
/// Firebase ID token, which the API exchanges for our own session on the
/// account registered under that email. The Firebase user is signed out again
/// straight away — the app's session lives in the API tokens, as with every
/// other sign-in method.
class EmailLinkSignIn {
  EmailLinkSignIn._();

  /// The Firebase Hosting domain the emailed link opens. The app claims
  /// [callbackPath] on it as a verified App Link, so tapping the link in the
  /// mail app lands here instead of a browser.
  static String get linkDomain =>
      '${DefaultFirebaseOptions.currentPlatform.projectId}.firebaseapp.com';

  /// Where Firebase Hosting delivers an email link that opens an app.
  static const callbackPath = '/__/auth/links';

  /// The address the link was sent to, kept so the student does not have to
  /// type it again when the link brings them back. Firebase requires the same
  /// email on completion — that is what stops a forwarded link from working
  /// on somebody else's phone.
  static const _pendingEmailKey = 'auth.emailLink.pendingEmail';

  static FirebaseAuth get _auth {
    if (Firebase.apps.isEmpty) {
      throw const EmailLinkFailure(
        'Email sign-in isn\'t available on this build. Please sign in with your password.',
      );
    }
    return FirebaseAuth.instance;
  }

  static Future<void> sendLink(String email, SharedPreferences prefs) async {
    final address = email.trim();
    try {
      await _auth.sendSignInLinkToEmail(
        email: address,
        actionCodeSettings: ActionCodeSettings(
          url: 'https://$linkDomain/email-signin',
          handleCodeInApp: true,
          androidPackageName: 'com.psctipsandtricks',
          androidInstallApp: true,
          iOSBundleId: 'com.psctipsandtricks',
        ),
      );
    } on FirebaseAuthException catch (e) {
      debugPrint(
        'FirebaseAuthException in sendSignInLinkToEmail:\n'
        '  code: ${e.code}\n'
        '  message: ${e.message}\n'
        '  plugin: ${e.plugin}\n'
        '  email: ${e.email}\n'
        '  credential: ${e.credential}\n'
        '  stackTrace: ${e.stackTrace}',
      );
      throw EmailLinkFailure(
        formatFirebaseError(e),
        code: e.code,
        debugDetail: '${e.code}: ${e.message}',
      );
    }
    await prefs.setString(_pendingEmailKey, address);
  }

  static String? pendingEmail(SharedPreferences prefs) =>
      prefs.getString(_pendingEmailKey);

  static Future<void> clearPendingEmail(SharedPreferences prefs) =>
      prefs.remove(_pendingEmailKey);

  /// Pulls the Firebase action link out of whatever reached the app: the
  /// hosting wrapper (`/__/auth/links?link=…`) the mail app opens, or the
  /// inner action URL itself when a student pastes it by hand.
  static String? extractActionLink(String raw) {
    var text = raw.trim();
    if (text.isEmpty) return null;

    // Strip wrapping brackets or quotes from email clients (<url>, "url", etc.)
    text = text.replaceAll(RegExp(r'^[<"\(]+|[>"\\)]+$'), '');

    var uri = Uri.tryParse(text);
    if (uri == null) return null;

    // Check if inner link is nested in query parameter
    while (uri != null && uri.queryParameters.containsKey('link')) {
      final inner = uri.queryParameters['link'];
      if (inner == null || inner.isEmpty) break;
      final decoded = Uri.decodeFull(inner);
      final nextUri = Uri.tryParse(decoded) ?? Uri.tryParse(inner);
      if (nextUri == null) break;
      uri = nextUri;
    }

    final resolvedUri = uri;
    if (resolvedUri == null) return null;

    String candidate = resolvedUri.toString();
    if (resolvedUri.scheme.isEmpty) {
      final pathWithQuery = candidate.startsWith('/') ? candidate : '/$candidate';
      candidate = 'https://$linkDomain$pathWithQuery';
    }

    // If Firebase Auth is initialized, test with the SDK method
    if (Firebase.apps.isNotEmpty) {
      try {
        if (FirebaseAuth.instance.isSignInWithEmailLink(candidate)) {
          return candidate;
        }
        if (FirebaseAuth.instance.isSignInWithEmailLink(text)) {
          return text;
        }
      } catch (e) {
        if (kDebugMode) debugPrint('Error verifying email link validity: $e');
      }
    }

    // Also check standard Firebase Auth action link query parameters (useful in tests and pre-init)
    final parsed = Uri.tryParse(candidate);
    if (parsed != null &&
        parsed.queryParameters.containsKey('oobCode') &&
        parsed.queryParameters.containsKey('apiKey')) {
      return candidate;
    }

    return null;
  }

  /// Signs out of Firebase Auth to ensure no lingering duplicate session.
  static Future<void> signOutFirebase() async {
    if (Firebase.apps.isEmpty) return;
    try {
      await FirebaseAuth.instance.signOut();
    } catch (e) {
      if (kDebugMode) debugPrint('Firebase sign-out failed: $e');
    }
  }

  /// Completes the sign-in and returns the Firebase ID token for the API.
  static Future<String> complete({
    required String email,
    required String link,
    required SharedPreferences prefs,
  }) async {
    final auth = _auth;
    try {
      final credential = await auth.signInWithEmailLink(
        email: email.trim(),
        emailLink: link,
      );
      final idToken = await credential.user?.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        throw const EmailLinkFailure('Could not verify your email. Please request a new link.');
      }
      await prefs.remove(_pendingEmailKey);
      return idToken;
    } on FirebaseAuthException catch (e) {
      debugPrint(
        'FirebaseAuthException in signInWithEmailLink:\n'
        '  code: ${e.code}\n'
        '  message: ${e.message}\n'
        '  plugin: ${e.plugin}\n'
        '  email: ${e.email}\n'
        '  credential: ${e.credential}\n'
        '  stackTrace: ${e.stackTrace}',
      );
      throw EmailLinkFailure(
        formatFirebaseError(e),
        code: e.code,
        debugDetail: '${e.code}: ${e.message}',
      );
    }
  }

  /// Formats the [FirebaseAuthException] to expose the exact error code and message.
  static String formatFirebaseError(FirebaseAuthException e) {
    final code = e.code.isNotEmpty ? e.code : 'unknown';
    final message = (e.message != null && e.message!.trim().isNotEmpty)
        ? e.message!.trim()
        : 'An unknown Firebase error occurred.';
    return 'Error code: $code\nMessage: $message';
  }
}

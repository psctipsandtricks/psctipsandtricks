import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart' hide User;
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/user.dart';
import '../auth/email_link_sign_in.dart';
import '../auth/google_native_sign_in.dart';
import '../auth/supabase_auth_service.dart';
import '../network/api_exception.dart';
import 'app_providers.dart';
import 'session.dart';

/// Where the session stands. The router keys its redirects off this, so it must
/// distinguish "still checking" from "definitely signed out".
enum AuthStatus { unknown, authenticated, unauthenticated }

@immutable
class AuthState {
  const AuthState({required this.status, this.user});

  final AuthStatus status;
  final User? user;

  bool get isAuthenticated => status == AuthStatus.authenticated && user != null;
  bool get isResolving => status == AuthStatus.unknown;

  static const unknown = AuthState(status: AuthStatus.unknown);
  static const signedOut = AuthState(status: AuthStatus.unauthenticated);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(AuthState.unknown) {
    // api_client drops the tokens itself when a refresh fails; all that is left
    // is to move the UI back to signed-out.
    _expirySub = _ref
        .read(apiClientProvider)
        .onSessionExpired
        .listen((_) => state = AuthState.signedOut);
    unawaited(restore());
  }

  final Ref _ref;
  StreamSubscription<void>? _expirySub;

  /// Cold start: paint from the cached user immediately, then reconcile with
  /// the server so a changed name or premium flag lands without a visible gap.
  Future<void> restore() async {
    final repo = _ref.read(authRepositoryProvider);
    final cached = await repo.restoreSession();
    if (cached == null) {
      // If local token storage was empty or reset, check if Supabase or Firebase Auth has an active persisted session
      try {
        final supaToken = SupabaseAuthService.currentAccessToken;
        if (supaToken != null && supaToken.isNotEmpty) {
          final user = await repo.loginWithSupabaseToken(supaToken);
          await _applySignIn(user);
          return;
        }
      } catch (e) {
        if (kDebugMode) debugPrint('Supabase restore fallback error: $e');
      }

      try {
        if (Firebase.apps.isNotEmpty) {
          final fbUser = FirebaseAuth.instance.currentUser;
          if (fbUser != null) {
            final idToken = await fbUser.getIdToken(true);
            if (idToken != null && idToken.isNotEmpty) {
              final user = await repo.loginWithFirebaseEmailLink(idToken);
              await _applySignIn(user);
              return;
            }
          }
        }
      } catch (e) {
        if (kDebugMode) debugPrint('Firebase restore fallback error: $e');
      }

      state = AuthState.signedOut;
      return;
    }
    state = AuthState(status: AuthStatus.authenticated, user: cached);

    try {
      final fresh = await repo.fetchMe();
      await repo.cacheUser(fresh);
      if (mounted) {
        state = AuthState(status: AuthStatus.authenticated, user: fresh);
      }
    } on ApiException catch (e) {
      // Only a rejected session signs the student out — a flaky network must
      // not throw away a perfectly good cached login.
      if (e.isUnauthorized && mounted) state = AuthState.signedOut;
    }
  }

  Future<void> login(String email, String password) async {
    final user = await _ref.read(authRepositoryProvider).login(
          email: email,
          password: password,
        );
    await _applySignIn(user);
  }

  /// Completes account creation with the code sent by
  /// `AuthRepository.sendRegisterOtp`, then signs the new student in.
  Future<void> verifyRegisterOtp({
    required String email,
    required String otp,
  }) async {
    final user = await _ref.read(authRepositoryProvider).verifyRegisterOtp(
          email: email,
          otp: otp,
        );
    await _applySignIn(user);
  }

  Future<void> completeOAuth({
    required String accessToken,
    required String refreshToken,
  }) async {
    final user = await _ref.read(authRepositoryProvider).completeOAuth(
          accessToken: accessToken,
          refreshToken: refreshToken,
        );
    await _applySignIn(user);
  }

  /// Signs in from Google tokens returned by the native account picker.
  Future<void> completeGoogleNative({String? idToken, String? accessToken}) async {
    final user = await _ref
        .read(authRepositoryProvider)
        .loginWithGoogleNativeTokens(idToken: idToken, accessToken: accessToken);
    await _applySignIn(user);
  }

  Future<void> completeEmailLink(String firebaseIdToken) async {
    final user = await _ref
        .read(authRepositoryProvider)
        .loginWithFirebaseEmailLink(firebaseIdToken);
    await _applySignIn(user);
    // Keep Firebase Auth user signed in so it persists in the native SDK on iOS & Android!
    // It will only be signed out when user explicitly calls logout().
  }

  Future<void> completeSupabaseLogin(String accessToken) async {
    final user = await _ref
        .read(authRepositoryProvider)
        .loginWithSupabaseToken(accessToken);
    await _applySignIn(user);
  }

  /// Moves the app into the signed-in state for [user], first scrubbing any
  /// state left by a different account. Logging out normally clears this
  /// already; the guard also covers a direct account switch and a session that
  /// was replaced without a clean sign-out.
  Future<void> _applySignIn(User user) async {
    final previousId = state.user?.id;
    if (previousId != user.id) {
      await clearAccountScopedState(_ref);
    }
    if (!mounted) return;
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  /// Applies a profile edit locally so every screen bound to the user rebuilds
  /// without another round trip.
  Future<void> applyUser(User user) async {
    await _ref.read(authRepositoryProvider).cacheUser(user);
    if (mounted) state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> logout() async {
    // Drop the platform's cached Google account, Supabase session, and Firebase user too
    await GoogleNativeSignIn.signOut();
    await SupabaseAuthService.signOut();
    await EmailLinkSignIn.signOutFirebase();
    await _ref.read(authRepositoryProvider).logout();
    state = AuthState.signedOut;
    // Tokens are gone; now take out everything that would otherwise outlive
    // them — the offline library on disk and every cached API response — so the
    // next account starts with access to nothing but its own purchases.
    await clearAccountScopedState(_ref);
  }

  @override
  void dispose() {
    _expirySub?.cancel();
    super.dispose();
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref));

/// The signed-in student, or null. Most screens only need this much.
final currentUserProvider =
    Provider<User?>((ref) => ref.watch(authControllerProvider).user);

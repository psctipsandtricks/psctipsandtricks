import '../../core/network/api_client.dart';
import '../../core/storage/token_store.dart';
import '../../core/utils/json.dart';
import '../models/user.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokens);

  final ApiClient _api;
  final TokenStore _tokens;

  Future<User> login({required String email, required String password}) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      body: {'email': email.trim(), 'password': password},
    );
    return _persist(AuthResponse.fromJson(res));
  }

  /// Step 1 of account creation: the server emails a 6-digit code and holds
  /// the pending registration server-side — no account exists yet.
  Future<Map<String, dynamic>> sendRegisterOtp({
    required String name,
    required String email,
    required String password,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/send-register-otp',
      body: {'name': name.trim(), 'email': email.trim(), 'password': password},
    );
    return res;
  }

  /// Step 2: the code from [sendRegisterOtp] creates the account and signs
  /// the student in, matching the website's registration flow.
  Future<User> verifyRegisterOtp({
    required String email,
    required String otp,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/verify-register-otp',
      body: {'email': email.trim(), 'otp': otp.trim()},
    );
    return _persist(AuthResponse.fromJson(res));
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/forgot-password',
      body: {'email': email.trim()},
    );
    return res;
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String email,
    required String otp,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/verify-otp',
      body: {
        'email': email.trim(),
        'otp': otp.trim(),
      },
    );
    return res;
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/reset-password',
      body: {
        'email': email.trim(),
        'otp': otp.trim(),
        'newPassword': newPassword,
      },
    );
    return res;
  }

  /// Trades an ID token from the device's native Google Sign-In for a session.
  ///
  /// Unlike [completeOAuth] this is an ordinary login round trip: the API
  /// verifies the token with Google and answers with the same shape as
  /// email/password login, so no follow-up profile fetch is needed.
  Future<User> loginWithGoogleNativeTokens({String? idToken, String? accessToken}) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/google/native',
      body: {
        if (idToken != null && idToken.isNotEmpty) 'idToken': idToken,
        if (accessToken != null && accessToken.isNotEmpty) 'accessToken': accessToken,
      },
    );
    return _persist(AuthResponse.fromJson(res));
  }

  Future<User> loginWithGoogleIdToken(String idToken) =>
      loginWithGoogleNativeTokens(idToken: idToken);

  /// Completes an OAuth sign-in: the backend redirect already handed us a token
  /// pair, so all that's left is to fetch the profile that goes with it.
  Future<User> completeOAuth({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _tokens.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    final user = await fetchMe();
    await _tokens.saveUser(user.toJson());
    return user;
  }

  Future<User> fetchMe() async {
    final res = await _api.get<Map<String, dynamic>>('/auth/me');
    return User.fromJson(res);
  }

  Future<UserProfile> fetchProfile(String userId) async {
    final res = await _api.get<Map<String, dynamic>>('/users/$userId');
    return UserProfile.fromJson(res);
  }

  Future<UserProfile> updateProfile(
    String userId, {
    String? name,
    String? phoneNumber,
  }) async {
    final res = await _api.patch<Map<String, dynamic>>(
      '/users/$userId',
      body: {
        if (name != null) 'name': name,
        if (phoneNumber != null) 'phoneNumber': phoneNumber,
      },
    );
    return UserProfile.fromJson(res);
  }

  Future<UserProfile> uploadAvatar(String userId, String filePath) async {
    final res = await _api.upload<Map<String, dynamic>>(
      '/users/$userId/avatar',
      filePath: filePath,
    );
    return UserProfile.fromJson(res);
  }

  Future<UserProfile> removeAvatar(String userId) async {
    final res = await _api.delete<Map<String, dynamic>>('/users/$userId/avatar');
    return UserProfile.fromJson(J.map(res));
  }

  /// The session cached on disk, used to paint a signed-in UI on cold start
  /// before `/auth/me` comes back.
  Future<User?> restoreSession() async {
    await _tokens.hydrate();
    if (!_tokens.hasSession) return null;
    final cached = await _tokens.readUser();
    return cached == null ? null : User.fromJson(cached);
  }

  Future<void> cacheUser(User user) => _tokens.saveUser(user.toJson());

  Future<void> logout() => _tokens.clear();

  Future<User> _persist(AuthResponse auth) async {
    await _tokens.saveTokens(
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
    );
    await _tokens.saveUser(auth.user.toJson());
    return auth.user;
  }
}

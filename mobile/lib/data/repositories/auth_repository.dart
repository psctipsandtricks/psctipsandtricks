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

  Future<User> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
      '/auth/register',
      body: {'name': name.trim(), 'email': email.trim(), 'password': password},
    );
    return _persist(AuthResponse.fromJson(res));
  }

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

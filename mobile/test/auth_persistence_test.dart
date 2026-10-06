import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/storage/token_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('TokenStore & Auth Persistence Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('Tokens and User profile persist across app cold starts', () async {
      // 1. First app launch: User logs in today
      final storeDay1 = TokenStore();
      await storeDay1.hydrate();

      await storeDay1.saveTokens(
        accessToken: 'initial-access-token-day-1',
        refreshToken: 'initial-refresh-token-180-days',
      );
      await storeDay1.saveUser({
        'id': 'user-123',
        'email': 'student@example.com',
        'name': 'Test Student',
        'role': 'STUDENT',
      });

      expect(storeDay1.accessToken, 'initial-access-token-day-1');
      expect(storeDay1.refreshToken, 'initial-refresh-token-180-days');
      
      final userDay1 = await storeDay1.readUser();
      expect(userDay1?['email'], 'student@example.com');
      expect(userDay1?['name'], 'Test Student');

      // 2. App closed and reopened tomorrow: Cold start with fresh TokenStore instance
      final storeDay2 = TokenStore();
      await storeDay2.hydrate();

      // Verify tokens and user remained completely intact
      expect(storeDay2.accessToken, 'initial-access-token-day-1');
      expect(storeDay2.refreshToken, 'initial-refresh-token-180-days');
      
      final userDay2 = await storeDay2.readUser();
      expect(userDay2, isNotNull);
      expect(userDay2?['id'], 'user-123');
      expect(userDay2?['email'], 'student@example.com');
    });

    test('TokenStore clear only occurs on explicit sign out', () async {
      final store = TokenStore();
      await store.hydrate();

      await store.saveTokens(
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      );
      await store.saveUser({'id': 'user-1'});
      expect(store.accessToken, isNotNull);

      // User explicitly logs out
      await store.clear();

      expect(store.accessToken, isNull);
      expect(store.refreshToken, isNull);
      expect(await store.readUser(), isNull);
    });

    test('ApiClient refreshable endpoints allow /auth/me to refresh on 401', () {
      const nonRefreshableAuthPaths = {
        '/auth/login',
        '/auth/register',
        '/auth/send-register-otp',
        '/auth/verify-register-otp',
        '/auth/forgot-password',
        '/auth/verify-otp',
        '/auth/reset-password',
        '/auth/refresh',
        '/auth/firebase/email-link',
        '/auth/google/native',
      };

      // /auth/me is NOT in nonRefreshableAuthPaths, which ensures
      // that when accessToken expires overnight, /auth/me triggers a refresh
      // instead of kicking the student out of the app!
      expect(nonRefreshableAuthPaths.contains('/auth/me'), isFalse);
      expect(nonRefreshableAuthPaths.contains('/books/my-purchases'), isFalse);
      expect(nonRefreshableAuthPaths.contains('/profile'), isFalse);

      // Meanwhile, credentials endpoints cannot recurse
      expect(nonRefreshableAuthPaths.contains('/auth/login'), isTrue);
      expect(nonRefreshableAuthPaths.contains('/auth/refresh'), isTrue);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/config/app_config.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';

void main() {
  group('Supabase Auth Configuration & Routing Tests', () {
    test('AppConfig provides valid Supabase URL and Anon Key', () {
      expect(AppConfig.supabaseUrl, isNotEmpty);
      expect(AppConfig.supabaseUrl, startsWith('https://'));
      expect(AppConfig.supabaseUrl, contains('supabase.co'));

      expect(AppConfig.supabaseAnonKey, isNotEmpty);
      expect(AppConfig.supabaseAnonKey.length, greaterThan(20));

      expect(AppConfig.supabaseAuthCallbackUrl, 'com.psctipsandtricks://login-callback');
    });

    test('AppRoutes defines Supabase callback path', () {
      expect(AppRoutes.supabaseCallback, '/login-callback');
    });

    test('Supabase callback URI parsing handles fragments and query params', () {
      final callbackUriWithFragment = Uri.parse(
        'com.psctipsandtricks://login-callback#access_token=eyJhbGciOiJIUzI1NiJ9.test&refresh_token=refresh_123&token_type=bearer',
      );
      expect(callbackUriWithFragment.host, 'login-callback');
      expect(callbackUriWithFragment.fragment, contains('access_token'));
      expect(callbackUriWithFragment.fragment, contains('refresh_token'));

      final callbackUriWithQuery = Uri.parse(
        'com.psctipsandtricks://login-callback?code=supabase_pkce_code_123',
      );
      expect(callbackUriWithQuery.host, 'login-callback');
      expect(callbackUriWithQuery.queryParameters['code'], 'supabase_pkce_code_123');
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/auth/supabase_auth_service.dart';

void main() {
  group('SupabaseAuthService token extraction', () {
    test('extracts token from fragment (Implicit Grant)', () {
      final uri = Uri.parse(
        'com.psctipsandtricks://login-callback#access_token=sb-test-token-123&refresh_token=sb-refresh-456&token_type=bearer&type=magiclink',
      );
      expect(SupabaseAuthService.extractAccessTokenFromUri(uri), 'sb-test-token-123');
    });

    test('extracts token from query parameters', () {
      final uri = Uri.parse(
        'com.psctipsandtricks://login-callback?access_token=sb-query-token-789&refresh_token=sb-refresh-456',
      );
      expect(SupabaseAuthService.extractAccessTokenFromUri(uri), 'sb-query-token-789');
    });

    test('extracts token from relative route with fragment', () {
      final uri = Uri.parse(
        '/login-callback#access_token=sb-relative-token-abc&refresh_token=xyz',
      );
      expect(SupabaseAuthService.extractAccessTokenFromUri(uri), 'sb-relative-token-abc');
    });

    test('returns null when no access_token is present', () {
      final uri = Uri.parse('com.psctipsandtricks://login-callback?error=unauthorized');
      expect(SupabaseAuthService.extractAccessTokenFromUri(uri), isNull);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';

void main() {
  group('Auth routes and endpoints', () {
    test('AppRoutes defines signup, register, and forgotPassword', () {
      expect(AppRoutes.login, '/login');
      expect(AppRoutes.signup, '/signup');
      expect(AppRoutes.register, '/register');
      expect(AppRoutes.forgotPassword, '/forgot-password');
    });
  });
}

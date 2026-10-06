import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/auth/email_link_sign_in.dart';
import 'package:psc_tips_tricks_mobile/core/providers/app_providers.dart';
import 'package:psc_tips_tricks_mobile/core/router/app_router.dart';
import 'package:psc_tips_tricks_mobile/features/auth/email_link_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('EmailLinkSignIn route and URL extraction', () {
    test('AppRoutes defines all email link routes', () {
      expect(AppRoutes.emailLink, '/email-link');
      expect(AppRoutes.emailLinkCallback, '/__/auth/links');
      expect(AppRoutes.emailSignInCallback, '/email-signin');
    });

    test('extractActionLink handles empty and invalid inputs', () {
      expect(EmailLinkSignIn.extractActionLink(''), isNull);
      expect(EmailLinkSignIn.extractActionLink('   '), isNull);
      expect(EmailLinkSignIn.extractActionLink('not a link'), isNull);
      expect(
          EmailLinkSignIn.extractActionLink('https://example.com/other-path'),
          isNull);
    });

    test('extractActionLink extracts link with apiKey and oobCode', () {
      const direct =
          'https://psc-tips-and-tricks-a5209.firebaseapp.com/email-signin?apiKey=test-api-key&mode=signIn&oobCode=code123';
      final extracted = EmailLinkSignIn.extractActionLink(direct);
      expect(extracted, direct);
    });

    test('extractActionLink extracts nested link parameter', () {
      const inner =
          'https://psc-tips-and-tricks-a5209.firebaseapp.com/email-signin?apiKey=test-key&mode=signIn&oobCode=secretCode';
      final wrapper =
          'https://psc-tips-and-tricks-a5209.firebaseapp.com/__/auth/links?link=${Uri.encodeComponent(inner)}';

      final extracted = EmailLinkSignIn.extractActionLink(wrapper);
      expect(extracted, inner);
    });

    test('extractActionLink cleans quotes and angle brackets from email apps',
        () {
      const raw =
          '<https://psc-tips-and-tricks-a5209.firebaseapp.com/email-signin?apiKey=test-key&mode=signIn&oobCode=secretCode>';
      const expected =
          'https://psc-tips-and-tricks-a5209.firebaseapp.com/email-signin?apiKey=test-key&mode=signIn&oobCode=secretCode';

      final extracted = EmailLinkSignIn.extractActionLink(raw);
      expect(extracted, expected);
    });

    test('extractActionLink handles relative paths with apiKey and oobCode',
        () {
      const relative =
          '/email-signin?apiKey=test-api-key&mode=signIn&oobCode=code123';
      final extracted = EmailLinkSignIn.extractActionLink(relative);
      expect(
        extracted,
        'https://${EmailLinkSignIn.linkDomain}/email-signin?apiKey=test-api-key&mode=signIn&oobCode=code123',
      );
    });
  });

  group('EmailLinkScreen widget tests', () {
    testWidgets('renders email input and send button with pre-filled email',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPrefsProvider.overrideWithValue(prefs),
          ],
          child: const MaterialApp(
            home: EmailLinkScreen(email: 'student@example.com'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Sign in with Email Link'), findsOneWidget);
      expect(find.text('student@example.com'), findsOneWidget);
      expect(find.text('Submit'), findsOneWidget);
      expect(find.byTooltip('Back'), findsOneWidget);
    });

    testWidgets('validates empty email field', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPrefsProvider.overrideWithValue(prefs),
          ],
          child: const MaterialApp(
            home: EmailLinkScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final button = find.text('Submit');
      await tester.tap(button);
      await tester.pumpAndSettle();

      expect(find.text('Enter your email'), findsOneWidget);
    });

    testWidgets('clears email with clear button', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPrefsProvider.overrideWithValue(prefs),
          ],
          child: const MaterialApp(
            home: EmailLinkScreen(email: 'student@example.com'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('student@example.com'), findsOneWidget);
      final clearBtn = find.byTooltip('Clear email');
      expect(clearBtn, findsOneWidget);

      await tester.tap(clearBtn);
      await tester.pumpAndSettle();

      expect(find.text('student@example.com'), findsNothing);
    });
  });
}

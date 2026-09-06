import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/features/auth/signup_screen.dart';

void main() {
  testWidgets(
    'SignupScreen starts on the details form, not the OTP step — account '
    'creation is gated behind email verification, matching the website',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.dark(),
            home: const SignupScreen(),
          ),
        ),
      );

      expect(find.text('Create your account'), findsOneWidget);
      expect(find.text('Create account'), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(3));
      expect(find.text('Verify your email'), findsNothing);
    },
  );
}

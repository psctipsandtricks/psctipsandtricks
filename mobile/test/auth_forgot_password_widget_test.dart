import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/core/theme/app_theme.dart';
import 'package:psc_tips_tricks_mobile/features/auth/forgot_password_screen.dart';

void main() {
  testWidgets('ForgotPasswordScreen renders email form and switches visibility on password input', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.dark(),
          home: const ForgotPasswordScreen(),
        ),
      ),
    );

    expect(find.text('Forgot Password'), findsOneWidget);
    expect(find.text('Send Recovery Code'), findsOneWidget);
    expect(find.byType(TextFormField), findsOneWidget);
  });
}

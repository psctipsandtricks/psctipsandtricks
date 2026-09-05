import 'package:flutter_test/flutter_test.dart';
import 'package:psc_tips_tricks_mobile/data/models/book.dart';
import 'package:psc_tips_tricks_mobile/data/models/quiz.dart';

void main() {
  group('Book Access Restrictions', () {
    test('premium book without access is locked and not free', () {
      final book = Book(
        id: 'b1',
        title: 'SCERT Basic Science',
        author: 'PSC',
        description: 'Test book',
        coverUrl: 'https://test.local/cover.jpg',
        price: 499,
        discountPercent: 0,
        finalPrice: 499,
        category: 'Science',
        isPremium: true,
        downloadCount: 10,
        access: const AccessState(
          isPaid: true,
          hasAccess: false,
          price: 499,
          reason: AccessReason.paymentRequired,
        ),
      );

      expect(book.isFree, isFalse);
      expect(book.isUnlocked, isFalse);
      expect(book.access?.hasAccess, isFalse);
    });

    test('premium book with missing access object remains locked', () {
      final book = Book(
        id: 'b2',
        title: 'SCERT Basic Science',
        author: 'PSC',
        description: 'Test book',
        coverUrl: 'https://test.local/cover.jpg',
        price: 499,
        discountPercent: 0,
        finalPrice: 499,
        category: 'Science',
        isPremium: true,
        downloadCount: 10,
        access: null,
      );

      expect(book.isFree, isFalse);
      expect(book.isUnlocked, isFalse);
    });

    test('purchased premium book is unlocked', () {
      final book = Book(
        id: 'b3',
        title: 'SCERT Basic Science',
        author: 'PSC',
        description: 'Test book',
        coverUrl: 'https://test.local/cover.jpg',
        price: 499,
        discountPercent: 0,
        finalPrice: 499,
        category: 'Science',
        isPremium: true,
        downloadCount: 10,
        access: const AccessState(
          isPaid: true,
          hasAccess: true,
          price: 499,
          reason: AccessReason.purchased,
        ),
      );

      expect(book.isUnlocked, isTrue);
    });

    test('free non-premium book is unlocked even without access object', () {
      final book = Book(
        id: 'b4',
        title: 'PSC Free Guide',
        author: 'PSC',
        description: 'Test book',
        coverUrl: 'https://test.local/cover.jpg',
        price: 0,
        discountPercent: 0,
        finalPrice: 0,
        category: 'General',
        isPremium: false,
        downloadCount: 100,
        access: null,
      );

      expect(book.isFree, isTrue);
      expect(book.isUnlocked, isTrue);
    });
  });

  group('Quiz Access Restrictions', () {
    test('paid premium quiz without access is locked', () {
      final quiz = Quiz(
        id: 'q1',
        title: 'Mega Mock Test',
        totalQuestions: 100,
        durationMinutes: 90,
        isLiveMock: true,
        isPremium: true,
        price: 199,
        passingMarks: 50,
        totalMarks: 100,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        access: const AccessState(
          isPaid: true,
          hasAccess: false,
          price: 199,
          reason: AccessReason.paymentRequired,
        ),
      );

      expect(quiz.isPaid, isTrue);
      expect(quiz.isLocked, isTrue);
      expect(quiz.isUnlocked, isFalse);
    });

    test('paid quiz with null access defaults to locked', () {
      final quiz = Quiz(
        id: 'q2',
        title: 'Premium Subject Test',
        totalQuestions: 50,
        durationMinutes: 45,
        isLiveMock: false,
        isPremium: true,
        price: 99,
        passingMarks: 25,
        totalMarks: 50,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        access: null,
      );

      expect(quiz.isPaid, isTrue);
      expect(quiz.isLocked, isTrue);
      expect(quiz.isUnlocked, isFalse);
    });

    test('purchased quiz is unlocked', () {
      final quiz = Quiz(
        id: 'q3',
        title: 'Purchased Test',
        totalQuestions: 50,
        durationMinutes: 45,
        isLiveMock: false,
        isPremium: true,
        price: 99,
        passingMarks: 25,
        totalMarks: 50,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        access: const AccessState(
          isPaid: true,
          hasAccess: true,
          price: 99,
          reason: AccessReason.purchased,
        ),
      );

      expect(quiz.isLocked, isFalse);
      expect(quiz.isUnlocked, isTrue);
    });

    test('free quiz is unlocked', () {
      final quiz = Quiz(
        id: 'q4',
        title: 'Free Daily Quiz',
        totalQuestions: 20,
        durationMinutes: 15,
        isLiveMock: false,
        isPremium: false,
        price: 0,
        passingMarks: 10,
        totalMarks: 20,
        negativeMarking: NegativeMarking.disabled,
        showCorrectAnswerAfterSelection: true,
        access: null,
      );

      expect(quiz.isPaid, isFalse);
      expect(quiz.isLocked, isFalse);
      expect(quiz.isUnlocked, isTrue);
    });
  });
}

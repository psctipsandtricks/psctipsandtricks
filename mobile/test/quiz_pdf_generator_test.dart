import 'package:flutter_test/flutter_test.dart';

import 'package:psc_tips_tricks_mobile/core/utils/quiz_pdf_generator.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('QuizPdfGenerator', () {
    test('produces a well-formed PDF for an English-only quiz', () async {
      final bytes = await QuizPdfGenerator.generate(
        quizTitle: 'General Knowledge Practice Set',
        category: 'Kerala PSC',
        score: 8,
        totalMarks: 10,
        questions: [
          QuizPdfQuestion(
            text: 'Which is the capital of Kerala?',
            options: const [
              QuizPdfOption(text: 'Kochi'),
              QuizPdfOption(text: 'Thiruvananthapuram', explanation: 'Seat of the state government.'),
              QuizPdfOption(text: 'Kozhikode'),
            ],
            correctIndex: 1,
            explanation: 'Thiruvananthapuram has been the capital since 1956.',
            marks: 1,
            userSelection: 0,
          ),
        ],
      );

      // A real PDF starts with the standard header and is non-trivially sized
      // once a question, its options and the watermark are all drawn.
      expect(String.fromCharCodes(bytes.take(5)), '%PDF-');
      expect(bytes.length, greaterThan(1000));
    });

    test('produces a well-formed PDF when Malayalam text is present', () async {
      // The whole point of the rasterisation path: this must not throw, and
      // must still come out as a valid PDF.
      final bytes = await QuizPdfGenerator.generate(
        quizTitle: 'കേരള പി.എസ്.സി പരീക്ഷ',
        questions: [
          QuizPdfQuestion(
            text: 'കേരളത്തിന്റെ തലസ്ഥാനം ഏതാണ്?',
            options: const [
              QuizPdfOption(text: 'കൊച്ചി'),
              QuizPdfOption(text: 'തിരുവനന്തപുരം'),
            ],
            correctIndex: 1,
            userSelection: 1,
          ),
        ],
      );

      expect(String.fromCharCodes(bytes.take(5)), '%PDF-');
      expect(bytes.length, greaterThan(1000));
    });

    test('handles a quiz with no score summary and no explanations', () async {
      final bytes = await QuizPdfGenerator.generate(
        quizTitle: 'Quick Quiz',
        questions: [
          QuizPdfQuestion(
            text: 'Unattempted question',
            options: const [QuizPdfOption(text: 'A'), QuizPdfOption(text: 'B')],
            correctIndex: 0,
            // No userSelection — mirrors an in-progress attempt.
          ),
        ],
      );

      expect(String.fromCharCodes(bytes.take(5)), '%PDF-');
    });
  });
}

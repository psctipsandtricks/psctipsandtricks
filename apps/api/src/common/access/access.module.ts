import { Global, Module } from '@nestjs/common';
import { QuizAccessService } from './quiz-access.service';
import { BookAccessService } from './book-access.service';

/**
 * Global so the paywall rule has exactly one implementation shared by the
 * quizzes/mock-tests and books modules — two copies could drift apart.
 */
@Global()
@Module({
  providers: [QuizAccessService, BookAccessService],
  exports: [QuizAccessService, BookAccessService],
})
export class AccessModule {}

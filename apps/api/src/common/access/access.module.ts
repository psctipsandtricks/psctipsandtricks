import { Global, Module } from '@nestjs/common';
import { QuizAccessService } from './quiz-access.service';

/**
 * Global so the paywall rule has exactly one implementation shared by the
 * quizzes and mock-tests modules — two copies could drift apart.
 */
@Global()
@Module({
  providers: [QuizAccessService],
  exports: [QuizAccessService],
})
export class AccessModule {}

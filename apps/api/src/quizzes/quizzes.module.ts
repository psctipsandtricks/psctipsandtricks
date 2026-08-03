import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuizProcessor } from './quiz.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'quiz-submissions',
    }),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizProcessor],
  exports: [QuizzesService],
})
export class QuizzesModule {}

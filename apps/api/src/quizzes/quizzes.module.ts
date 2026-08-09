import { Module } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuizProcessor } from './quiz.processor';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizProcessor],
  exports: [QuizzesService],
})
export class QuizzesModule {}

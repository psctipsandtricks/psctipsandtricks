import { Module } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { QuizProcessor } from './quiz.processor';
import { ChatModule } from '../chat/chat.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ChatModule, StorageModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizProcessor],
  exports: [QuizzesService],
})
export class QuizzesModule {}

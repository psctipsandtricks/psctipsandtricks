import { Module } from '@nestjs/common';
import { MockTestsService } from './mock-tests.service';
import { MockTestsController } from './mock-tests.controller';
import { MockTestProcessor } from './mock-test.processor';
import { MockTestSchedulerService } from './mock-test-scheduler.service';
import { ChatModule } from '../chat/chat.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [ChatModule, SyncModule],
  controllers: [MockTestsController],
  providers: [MockTestsService, MockTestProcessor, MockTestSchedulerService],
  exports: [MockTestsService],
})
export class MockTestsModule {}

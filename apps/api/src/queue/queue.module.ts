import { Global, Module } from '@nestjs/common';
import { SupabaseQueueService } from './queue.service';

@Global()
@Module({
  providers: [SupabaseQueueService],
  exports: [SupabaseQueueService],
})
export class QueueModule {}

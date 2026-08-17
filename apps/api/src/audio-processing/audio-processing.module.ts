import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AudioProcessingService } from './audio-processing.service';
import { AudioProcessingProcessor } from './audio-processing.processor';

@Module({
  imports: [StorageModule],
  providers: [AudioProcessingService, AudioProcessingProcessor],
  exports: [AudioProcessingService],
})
export class AudioProcessingModule {}

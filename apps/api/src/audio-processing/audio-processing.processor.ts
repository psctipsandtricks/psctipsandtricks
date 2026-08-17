import { Injectable, Logger } from '@nestjs/common';
import { QueuePoller } from '../queue/queue-poller';
import { SupabaseQueueService } from '../queue/queue.service';
import { AudioProcessingService } from './audio-processing.service';
import { AudioSyncJobMessage } from './audio-processing.types';

@Injectable()
export class AudioProcessingProcessor extends QueuePoller<AudioSyncJobMessage> {
  protected readonly queueName = 'audio-sync';
  protected readonly logger = new Logger(AudioProcessingProcessor.name);
  // ffmpeg + whisper.cpp on CPU can run for many minutes on a long chapter —
  // a short visibility timeout would let pgmq redeliver an in-flight job to
  // another poll and double-process the same file.
  protected readonly visibilityTimeoutSeconds = 3600;
  protected readonly batchSize = 1;

  constructor(
    queueService: SupabaseQueueService,
    private audioProcessingService: AudioProcessingService,
  ) {
    super(queueService);
  }

  protected async handle(message: AudioSyncJobMessage): Promise<void> {
    await this.audioProcessingService.process(message);
  }
}

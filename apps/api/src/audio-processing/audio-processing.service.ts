import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseQueueService } from '../queue/queue.service';
import { AudioEntityType, AudioSyncJobMessage, AudioSyncSegment } from './audio-processing.types';
import { denoiseAudio } from './ffmpeg-denoise.util';
import { transcribeWithWhisper } from './whisper-transcribe.util';
import { extractPdfGroundTruth } from './pdf-text-extractor.util';
import { buildAudioSyncSegments } from './text-alignment.util';

const QUEUE_NAME = 'audio-sync';

const PROCESSED_AUDIO_BUCKETS: Record<AudioEntityType, string> = {
  chapter: 'chapter-audio-processed',
  topic: 'topic-audio-processed',
  subtopic: 'subtopic-audio-processed',
};

type SyncStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

@Injectable()
export class AudioProcessingService {
  private readonly logger = new Logger(AudioProcessingService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private configService: ConfigService,
    private queueService: SupabaseQueueService,
  ) {}

  /**
   * Enqueues an entity's currently-uploaded audio for AI noise removal (and,
   * if a PDF is also present, transcription + PDF sync). Used both for
   * fresh uploads and for admin-triggered reprocessing. `originalAudioUrl`
   * is only written when provided (e.g. backfilling a legacy row that
   * predates this feature) — omit it to leave the existing value alone.
   */
  async enqueue(entityType: AudioEntityType, entityId: string, originalAudioUrl?: string): Promise<void> {
    const data: Record<string, unknown> = { audioSyncStatus: 'PENDING' as SyncStatus, audioSyncError: null };
    if (originalAudioUrl) data.originalAudioUrl = originalAudioUrl;
    await this.updateEntity(entityType, entityId, data);
    const message: AudioSyncJobMessage = { entityType, entityId };
    await this.queueService.send(QUEUE_NAME, message as unknown as Record<string, unknown>);
  }

  /**
   * Bulk variant for the admin "Process All Unsynced Audio" backfill —
   * batches enqueue calls with bounded concurrency instead of one job at a
   * time, since a book's catalog can easily be 100+ chapters/topics and a
   * fully sequential loop was slow enough to time out the HTTP request.
   */
  async enqueueBulk(jobs: { entityType: AudioEntityType; entityId: string; originalAudioUrl: string }[]): Promise<void> {
    const CONCURRENCY = 5;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((job) => this.enqueue(job.entityType, job.entityId, job.originalAudioUrl)));
    }
  }

  async process(message: AudioSyncJobMessage): Promise<void> {
    const { entityType, entityId } = message;
    try {
      await this.setStatus(entityType, entityId, 'PROCESSING', null);
      await this.runPipeline(entityType, entityId);
    } catch (err) {
      const errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
      this.logger.error(`Audio processing failed for ${entityType} ${entityId}: ${errorMessage}`);
      await this.setStatus(entityType, entityId, 'FAILED', errorMessage);
      throw err; // let QueuePoller's retry/archive logic still apply
    }
  }

  private async runPipeline(entityType: AudioEntityType, entityId: string): Promise<void> {
    const entity = await this.getEntity(entityType, entityId);
    const sourceAudioUrl: string | null = entity.originalAudioUrl ?? entity.audioUrl;
    if (!sourceAudioUrl) throw new Error('No audio to process');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `audio-sync-${entityType}-${entityId}-`));
    try {
      const inputPath = path.join(tmpDir, 'input');
      await this.downloadToFile(sourceAudioUrl, inputPath);

      const denoisedPath = path.join(tmpDir, 'denoised.wav');
      await denoiseAudio(inputPath, denoisedPath, {
        ffmpegPath: this.configService.get<string>('FFMPEG_PATH') || 'ffmpeg',
        rnnoiseModelPath: this.resolveLocalPath(this.configService.get<string>('RNNOISE_MODEL_PATH')),
      });

      const processedBuffer = await fs.readFile(denoisedPath);
      const processedUrl = await this.storageService.upload(
        PROCESSED_AUDIO_BUCKETS[entityType],
        `${entityId}/${Date.now()}-denoised.wav`,
        processedBuffer,
        'audio/wav',
      );

      const segments = entity.pdfUrl
        ? await this.tryBuildSyncSegments(entityType, entityId, entity.pdfUrl, denoisedPath, tmpDir)
        : null;

      await this.updateEntity(entityType, entityId, {
        audioUrl: processedUrl,
        audioSyncStatus: 'READY' as SyncStatus,
        audioSyncSegments: segments,
        audioSyncError: null,
        audioSyncedAt: new Date(),
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Transcription/alignment is best-effort: a scanned/image-only PDF (no
   * extractable text) or a transcription hiccup shouldn't fail the whole
   * job when the denoised audio itself is good — it just ships without sync
   * segments, same as a unit with no PDF at all.
   */
  private async tryBuildSyncSegments(
    entityType: AudioEntityType,
    entityId: string,
    pdfUrl: string,
    denoisedAudioPath: string,
    tmpDir: string,
  ): Promise<AudioSyncSegment[] | null> {
    try {
      const pdfPath = path.join(tmpDir, 'source.pdf');
      await this.downloadToFile(pdfUrl, pdfPath);
      const pdfBuffer = await fs.readFile(pdfPath);
      const groundTruth = await extractPdfGroundTruth(pdfBuffer);

      const whisperWords = await transcribeWithWhisper(denoisedAudioPath, {
        binaryPath: this.resolveLocalPath(this.configService.get<string>('WHISPER_CPP_BINARY_PATH')),
        modelPath: this.resolveLocalPath(this.configService.get<string>('WHISPER_MODEL_PATH')),
      });

      return buildAudioSyncSegments(groundTruth, whisperWords);
    } catch (err) {
      this.logger.warn(
        `Sync alignment skipped for ${entityType} ${entityId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Resolves a model/binary path (RNNoise model, whisper model, whisper.cpp binary) against apps/api's cwd if relative, matching where the prebuild scripts put them. */
  private resolveLocalPath(configured: string | undefined): string {
    const value = configured || '';
    if (path.isAbsolute(value)) return value;
    return path.resolve(process.cwd(), value);
  }

  private async downloadToFile(url: string, destPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destPath, buffer);
  }

  private async getEntity(entityType: AudioEntityType, entityId: string): Promise<any> {
    switch (entityType) {
      case 'chapter':
        return this.prisma.chapter.findUniqueOrThrow({ where: { id: entityId } });
      case 'topic':
        return this.prisma.topic.findUniqueOrThrow({ where: { id: entityId } });
      case 'subtopic':
        return this.prisma.subtopic.findUniqueOrThrow({ where: { id: entityId } });
    }
  }

  private async updateEntity(entityType: AudioEntityType, entityId: string, data: Record<string, unknown>): Promise<any> {
    switch (entityType) {
      case 'chapter':
        return this.prisma.chapter.update({ where: { id: entityId }, data });
      case 'topic':
        return this.prisma.topic.update({ where: { id: entityId }, data });
      case 'subtopic':
        return this.prisma.subtopic.update({ where: { id: entityId }, data });
    }
  }

  private async setStatus(
    entityType: AudioEntityType,
    entityId: string,
    status: SyncStatus,
    error: string | null,
  ): Promise<void> {
    await this.updateEntity(entityType, entityId, { audioSyncStatus: status, audioSyncError: error });
  }
}

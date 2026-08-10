import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as WebSocket from 'ws';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && serviceKey) {
      this.client = createClient(url, serviceKey, {
        auth: { persistSession: false },
        realtime: {
          transport: WebSocket as any,
        },
      });
    } else {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — file uploads are disabled.');
    }
  }

  /**
   * Supabase Storage rejects object keys containing anything outside a narrow
   * safe set — macOS screenshots, for example, carry a narrow no-break space
   * (U+202F) before "AM"/"PM", which fails with "Invalid key". Normalise each
   * path segment to `[A-Za-z0-9._-]` so any filename a user picks can upload.
   */
  static sanitizeObjectKey(path: string): string {
    return path
      .split('/')
      .map((segment) =>
        segment
          .normalize('NFKD')
          // strip accents/marks left behind by the decomposition
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Za-z0-9._-]+/g, '-')
          .replace(/-{2,}/g, '-')
          .replace(/^[-.]+|[-.]+$/g, ''),
      )
      .filter(Boolean)
      .join('/');
  }

  async upload(bucket: string, rawPath: string, buffer: Buffer, contentType: string): Promise<string> {
    const path = StorageService.sanitizeObjectKey(rawPath);
    if (!this.client) {
      throw new InternalServerErrorException(
        'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env',
      );
    }

    let { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    // A brand new deployment won't have the bucket yet — create it once and retry
    // rather than requiring a manual step in the Supabase dashboard.
    if (error && /bucket not found/i.test(error.message)) {
      this.logger.warn(`Bucket "${bucket}" missing — creating it.`);
      const { error: createError } = await this.client.storage.createBucket(bucket, { public: true });
      if (createError && !/already exists/i.test(createError.message)) {
        this.logger.error(`Could not create bucket "${bucket}": ${createError.message}`);
        throw new InternalServerErrorException('File upload failed');
      }
      ({ error } = await this.client.storage.from(bucket).upload(path, buffer, {
        contentType,
        upsert: true,
      }));
    }

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new InternalServerErrorException('File upload failed');
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}

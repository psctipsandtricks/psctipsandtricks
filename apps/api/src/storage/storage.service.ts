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

  /**
   * Splits one of our own public URLs back into the bucket and object key it
   * points at, or null if it is not ours.
   *
   * "Ours" is deliberately strict — the origin has to match the configured
   * Supabase project and the path has to have the exact public-object shape.
   * Records hold plenty of URLs this must never match: Google profile photos,
   * YouTube thumbnails, and URLs carried over verbatim from the legacy PHP app.
   * Anything unrecognised is somebody else's file and is left alone.
   */
  parsePublicUrl(url: string | null | undefined): { bucket: string; path: string } | null {
    if (!url) return null;

    const base = this.configService.get<string>('SUPABASE_URL');
    if (!base) return null;

    let parsed: URL;
    let origin: URL;
    try {
      parsed = new URL(url);
      origin = new URL(base);
    } catch {
      return null;
    }
    if (parsed.host !== origin.host) return null;

    // /storage/v1/object/public/<bucket>/<path...>
    const segments = parsed.pathname.split('/').filter(Boolean);
    const marker = ['storage', 'v1', 'object', 'public'];
    if (segments.length < marker.length + 2) return null;
    if (marker.some((part, i) => segments[i] !== part)) return null;

    const bucket = segments[marker.length];
    const path = segments
      .slice(marker.length + 1)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    if (!bucket || !path) return null;

    return { bucket, path };
  }

  /**
   * Deletes a file this application uploaded, given the public URL held in a
   * record.
   *
   * Never throws. A file left behind is wasted storage; an exception here would
   * fail a request whose real work — the new file and the updated record — has
   * already succeeded, which is far worse. Every outcome is logged instead.
   *
   * [ownedBy] is a required safety catch rather than an option: every upload
   * path in this codebase embeds the id of the record it belongs to, so
   * insisting the key contains that id is what stops a record whose URL was
   * hand-edited to point at *another* record's file from deleting it. Pass the
   * id the file should belong to.
   */
  async removeOwnedFile(
    url: string | null | undefined,
    ownedBy: string,
  ): Promise<boolean> {
    const target = this.parsePublicUrl(url);
    if (!target || !this.client) return false;

    if (!ownedBy || !target.path.includes(ownedBy)) {
      this.logger.warn(
        `Refusing to delete "${target.path}" — it is not filed under ${ownedBy}.`,
      );
      return false;
    }

    try {
      const { error } = await this.client.storage
        .from(target.bucket)
        .remove([target.path]);
      if (error) {
        this.logger.warn(
          `Could not delete replaced file ${target.bucket}/${target.path}: ${error.message}`,
        );
        return false;
      }
      this.logger.log(`Deleted replaced file ${target.bucket}/${target.path}`);
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Could not delete replaced file ${target.bucket}/${target.path}: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * The whole replace-a-file rule in one place: drop [previousUrl] now that
   * [currentUrl] has taken over.
   *
   * Only ever called *after* the new file is stored and the record updated, so
   * a failure anywhere earlier leaves the old file exactly where it was. Also
   * declines when the two URLs are the same, which happens when an upload
   * overwrites its own key rather than writing a new one — deleting there would
   * throw away the file that was just uploaded.
   */
  async removeReplacedFile(
    previousUrl: string | null | undefined,
    currentUrl: string | null | undefined,
    ownedBy: string,
  ): Promise<boolean> {
    if (!previousUrl || previousUrl === currentUrl) return false;
    return this.removeOwnedFile(previousUrl, ownedBy);
  }
}

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && serviceKey) {
      this.client = createClient(url, serviceKey);
    } else {
      this.logger.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — file uploads are disabled.');
    }
  }

  async upload(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
    if (!this.client) {
      throw new InternalServerErrorException(
        'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env',
      );
    }

    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new InternalServerErrorException('File upload failed');
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}

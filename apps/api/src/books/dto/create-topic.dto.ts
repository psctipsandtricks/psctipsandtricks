import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PdfSyncMapDto } from './sync-cues.dto';

export class CreateTopicDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  /** Subtitle-style PDF↔audio timing map for this topic's audio + PDF pair. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PdfSyncMapDto)
  syncCues?: PdfSyncMapDto;
}

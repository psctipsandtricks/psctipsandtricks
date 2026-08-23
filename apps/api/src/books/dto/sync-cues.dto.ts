import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Matches MAX_OFFSET_MS in the reader's pdf-audio-sync module. */
const MAX_OFFSET_MS = 120_000;
/** ~8h of audio in ms — a sanity ceiling, not a product limit. */
const MAX_TIMESTAMP_MS = 8 * 60 * 60 * 1000;
/** A lecture deck with more pages than this is not a sync problem. */
const MAX_PAGE = 5000;

/**
 * One subtitle-style segment: `[startMs, endMs)` of audio shown against `page`.
 * Timestamps are integer milliseconds from the start of the track.
 */
export class PdfSyncCueDto {
  @IsInt()
  @Min(0)
  @Max(MAX_TIMESTAMP_MS)
  startMs: number;

  @IsInt()
  @Min(0)
  @Max(MAX_TIMESTAMP_MS)
  endMs: number;

  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number;
}

export class PdfSyncMapDto {
  @IsOptional()
  @IsInt()
  @Min(-MAX_OFFSET_MS)
  @Max(MAX_OFFSET_MS)
  offsetMs?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PdfSyncCueDto)
  cues: PdfSyncCueDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  revision?: number;
}

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
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

/** Matches PdfSyncRegionKind in `packages/shared-types`. */
const REGION_KINDS = [
  'text',
  'heading',
  'image',
  'table',
  'diagram',
  'other',
] as const;

/**
 * The part of a page a cue points at, as a fraction of the page box — origin
 * top-left, every value in `[0, 1]`.
 *
 * Fractions rather than pixels so one map drives a phone, a browser and every
 * zoom level in between. A zero-size rect is meaningless, so width and height
 * have a floor; it sits below the reader's own 0.002 minimum, which means a
 * client that normalizes first never trips it.
 */
export class PdfSyncRegionDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @IsNumber()
  @Min(0.001)
  @Max(1)
  width: number;

  @IsNumber()
  @Min(0.001)
  @Max(1)
  height: number;
}

/**
 * One subtitle-style segment: `[startMs, endMs)` of audio shown against `page`,
 * and optionally against a region of that page.
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

  /**
   * Omitted means the whole page, which is what every cue authored before
   * regions existed means. Decorated rather than left free-form because the
   * global ValidationPipe whitelists: an undeclared property is stripped in
   * silence, and a sync map that saves without its regions is worse than one
   * that refuses to save.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PdfSyncRegionDto)
  target?: PdfSyncRegionDto;

  @IsOptional()
  @IsIn(REGION_KINDS as unknown as string[])
  type?: (typeof REGION_KINDS)[number];
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

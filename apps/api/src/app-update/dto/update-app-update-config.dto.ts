import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

/** Matches `isValidVersion` in `common/semver.ts` — kept as a literal regex
 * here too so the DTO's own validation fires before the request ever reaches
 * the service, with a message the admin form can show directly. */
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Wire shape deliberately mirrors the public `GET /app/update-config`
 * response the mobile app reads (lowercase `updateMode`, no Prisma-enum
 * casing leaking out) — the admin form round-trips the same JSON it fetched,
 * mapped to the DB's `AppUpdateMode` enum only inside the service.
 */
export class UpdateAppUpdateConfigDto {
  /** Defaults to 'android' — the only platform wired up today. */
  @IsOptional()
  @IsIn(['android', 'ios'], { message: 'Platform must be "android" or "ios"' })
  platform?: 'android' | 'ios';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['immediate', 'flexible'], { message: 'Update mode must be "immediate" or "flexible"' })
  updateMode?: 'immediate' | 'flexible';

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: 'Minimum version must look like 2.5.0 (major.minor.patch, no leading zeros)' })
  minimumVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(VERSION_PATTERN, { message: 'Latest version must look like 2.6.0 (major.minor.patch, no leading zeros)' })
  latestVersion?: string;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Update message must be between 1 and 500 characters' })
  message?: string;
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { AppPlatform, AppUpdateConfig, AppUpdateMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compareVersions, isValidVersion } from '../common/semver';
import { UpdateAppUpdateConfigDto } from './dto/update-app-update-config.dto';

/** The wire shape both the mobile app and the admin form read and write —
 * see the DTO for why this stays separate from the Prisma row shape. */
export interface AppUpdateConfigResponse {
  enabled: boolean;
  latestVersion: string;
  minimumVersion: string;
  updateMode: 'immediate' | 'flexible';
  forceUpdate: boolean;
  message: string;
  updatedAt: string;
}

const toWireMode = (mode: AppUpdateMode): 'immediate' | 'flexible' =>
  mode === AppUpdateMode.IMMEDIATE ? 'immediate' : 'flexible';
const toDbMode = (mode: 'immediate' | 'flexible'): AppUpdateMode =>
  mode === 'immediate' ? AppUpdateMode.IMMEDIATE : AppUpdateMode.FLEXIBLE;

const toWirePlatform = (platform: AppPlatform): 'android' | 'ios' => (platform === AppPlatform.ANDROID ? 'android' : 'ios');
const toDbPlatform = (platform?: 'android' | 'ios'): AppPlatform =>
  platform === 'ios' ? AppPlatform.IOS : AppPlatform.ANDROID;

function toResponse(row: AppUpdateConfig): AppUpdateConfigResponse {
  return {
    enabled: row.enabled,
    latestVersion: row.latestVersion,
    minimumVersion: row.minimumVersion,
    updateMode: toWireMode(row.updateMode),
    forceUpdate: row.forceUpdate,
    message: row.updateMessage,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class AppUpdateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Public — the mobile app calls this on every launch, and the admin form
   * calls it once to prefill. No row yet just means the model's own defaults
   * (update check ON, Immediate, Force ON), materialised on first read rather
   * than at migration time so a fresh environment needs no seed step.
   */
  async get(platform: 'android' | 'ios' = 'android'): Promise<AppUpdateConfigResponse> {
    const dbPlatform = toDbPlatform(platform);
    const existing = await this.prisma.appUpdateConfig.findUnique({ where: { platform: dbPlatform } });
    if (existing) return toResponse(existing);

    const created = await this.prisma.appUpdateConfig.create({ data: { platform: dbPlatform } });
    return toResponse(created);
  }

  /** Admin/Staff with `manageAppUpdate` only — see the controller's guards. */
  async update(dto: UpdateAppUpdateConfigDto): Promise<AppUpdateConfigResponse> {
    const dbPlatform = toDbPlatform(dto.platform);

    // Both bounds may arrive in the same request (or neither) — validate
    // against whichever pair will actually be live after this write, not just
    // the two fields present on the DTO in isolation.
    const existing = await this.prisma.appUpdateConfig.findUnique({ where: { platform: dbPlatform } });
    const nextMinimum = dto.minimumVersion ?? existing?.minimumVersion ?? '1.0.0';
    const nextLatest = dto.latestVersion ?? existing?.latestVersion ?? '1.0.0';

    if (dto.minimumVersion !== undefined && !isValidVersion(dto.minimumVersion)) {
      throw new BadRequestException('Minimum version must look like 2.5.0 (major.minor.patch)');
    }
    if (dto.latestVersion !== undefined && !isValidVersion(dto.latestVersion)) {
      throw new BadRequestException('Latest version must look like 2.6.0 (major.minor.patch)');
    }
    if (compareVersions(nextMinimum, nextLatest) > 0) {
      throw new BadRequestException('Minimum supported version cannot be greater than the latest version');
    }

    const data = {
      enabled: dto.enabled,
      updateMode: dto.updateMode === undefined ? undefined : toDbMode(dto.updateMode),
      minimumVersion: dto.minimumVersion,
      latestVersion: dto.latestVersion,
      forceUpdate: dto.forceUpdate,
      updateMessage: dto.message,
    };

    const row = await this.prisma.appUpdateConfig.upsert({
      where: { platform: dbPlatform },
      create: { platform: dbPlatform, ...data },
      update: data,
    });
    return toResponse(row);
  }
}

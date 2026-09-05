import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AppUpdateService } from './app-update.service';
import { UpdateAppUpdateConfigDto } from './dto/update-app-update-config.dto';

const MANAGE_APP_UPDATE_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

/**
 * Path is `app/update-config` rather than nested under `/admin` — like
 * social-links, the read side is public (the mobile app has no session yet
 * when it makes this call, and often no network reason to have one) and the
 * write side is guard-gated on the same route, so there is one contract for
 * both callers instead of two shapes to keep in sync.
 */
@ApiTags('App Update')
@Controller('app/update-config')
export class AppUpdateController {
  constructor(private readonly appUpdateService: AppUpdateService) {}

  @ApiOperation({
    summary:
      'Current update configuration for a platform — public. Exposes only version numbers and update-flow settings, nothing account-specific, so it is safe to call before the app has signed in or gone through Supabase/API init.',
  })
  @ApiQuery({ name: 'platform', required: false, enum: ['android', 'ios'] })
  @Get()
  async get(@Query('platform') platform?: 'android' | 'ios') {
    return this.appUpdateService.get(platform === 'ios' ? 'ios' : 'android');
  }

  @ApiOperation({ summary: 'Update the app-update configuration (Admin / Staff with manageAppUpdate)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_APP_UPDATE_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAppUpdate')
  @Patch()
  async update(@Body() dto: UpdateAppUpdateConfigDto) {
    return this.appUpdateService.update(dto);
  }
}

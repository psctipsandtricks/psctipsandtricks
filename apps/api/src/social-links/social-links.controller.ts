import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSocialLinksDto } from './dto/update-social-links.dto';
import { SocialLinksService } from './social-links.service';

const MANAGE_SOCIAL_LINKS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Social Links')
@Controller('social-links')
export class SocialLinksController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @ApiOperation({ summary: 'Configured social links — public, used by both the home page and the admin form' })
  @Get()
  async get() {
    return this.socialLinksService.get();
  }

  @ApiOperation({ summary: 'Update the social links (Admin / Staff with manage_social_links)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_SOCIAL_LINKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageSocialLinks')
  @Patch()
  async update(@Body() dto: UpdateSocialLinksDto) {
    return this.socialLinksService.update(dto);
  }
}

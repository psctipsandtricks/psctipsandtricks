import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

const MANAGE_NOTIFICATIONS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Compose and dispatch push notification (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Post('send')
  async send(@Request() req: any, @Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Get user notifications' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyNotifications(@Request() req: any) {
    return this.notificationsService.getUserNotifications(req.user.id);
  }

  @ApiOperation({ summary: 'List announcement popups (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Get('announcements')
  async listAnnouncements() {
    return this.notificationsService.listAnnouncements();
  }

  @ApiOperation({ summary: 'Get currently active announcement popup(s) for end users' })
  @Get('announcements/active')
  async activeAnnouncements() {
    return this.notificationsService.getActiveAnnouncements();
  }

  @ApiOperation({ summary: 'Create an announcement popup (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Post('announcements')
  async createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.notificationsService.createAnnouncement(dto);
  }

  @ApiOperation({ summary: 'Update an announcement popup (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Patch('announcements/:id')
  async updateAnnouncement(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.notificationsService.updateAnnouncement(id, dto);
  }

  @ApiOperation({ summary: 'Delete an announcement popup (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Delete('announcements/:id')
  async removeAnnouncement(@Param('id') id: string) {
    return this.notificationsService.removeAnnouncement(id);
  }
}

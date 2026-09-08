import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';
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

  @ApiOperation({ summary: 'Upload rich notification image banner (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @Post('image')
  async uploadNotificationImage(@UploadedFile() file: Express.Multer.File) {
    return this.notificationsService.uploadNotificationImage(file);
  }

  @ApiOperation({ summary: 'Get user notifications' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyNotifications(@Request() req: any) {
    return this.notificationsService.getUserNotifications(req.user.id);
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markNotificationRead(id, req.user.id);
  }

  @ApiOperation({
    summary: 'Mark several notifications as read (all visible ones when no ids are given)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('read')
  async markManyRead(@Request() req: any, @Body() dto: MarkNotificationsReadDto) {
    return this.notificationsService.markNotificationsRead(req.user.id, dto?.ids);
  }

  @ApiOperation({ summary: 'Register this device for push notifications' })
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('devices')
  async registerDevice(@Request() req: any, @Body() dto: RegisterDeviceDto) {
    // Signed out is allowed: the app registers as soon as FCM issues a token so
    // broadcasts reach browsers of the catalog too, and the row is re-pointed
    // at the student the moment they sign in.
    return this.notificationsService.registerDevice(req.user?.id ?? null, dto);
  }

  @ApiOperation({ summary: 'Recently sent notifications (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Get('sent')
  async listSent(@Query('limit') limit?: string) {
    return this.notificationsService.listSentNotifications(Number(limit) || 100);
  }

  @ApiOperation({ summary: 'Delete a sent or scheduled notification (Admin / Staff with manage_notifications)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.notificationsService.deleteNotification(id);
  }

  @ApiOperation({ summary: 'Whether push delivery is configured, and how many devices are registered' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageNotifications')
  @Get('push-status')
  async pushStatus() {
    return this.notificationsService.getPushStatus();
  }

  @ApiOperation({ summary: 'List announcement popups (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @Get('announcements')
  async listAnnouncements() {
    return this.notificationsService.listAnnouncements();
  }

  @ApiOperation({ summary: 'Get currently active announcement popup(s) for end users' })
  @Get('announcements/active')
  async activeAnnouncements() {
    return this.notificationsService.getActiveAnnouncements();
  }

  @ApiOperation({ summary: 'Create an announcement popup (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @Post('announcements')
  async createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.notificationsService.createAnnouncement(dto);
  }

  @ApiOperation({ summary: 'Reorder announcement popups (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @Patch('announcements/reorder')
  async reorderAnnouncements(@Body('ids') ids: string[]) {
    return this.notificationsService.reorderAnnouncements(ids || []);
  }

  @ApiOperation({ summary: 'Update an announcement popup (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @Patch('announcements/:id')
  async updateAnnouncement(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.notificationsService.updateAnnouncement(id, dto);
  }

  @ApiOperation({ summary: 'Upload announcement banner image (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @UseInterceptors(FileInterceptor('file'))
  @Post('announcements/banner-image')
  async uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
    return this.notificationsService.uploadBannerImage(file);
  }

  @ApiOperation({ summary: 'Delete an announcement popup (Admin / Staff with manage_announcements)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_NOTIFICATIONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageAnnouncements')
  @Delete('announcements/:id')
  async removeAnnouncement(@Param('id') id: string) {
    return this.notificationsService.removeAnnouncement(id);
  }
}

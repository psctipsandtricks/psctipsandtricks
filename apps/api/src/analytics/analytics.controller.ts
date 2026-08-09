import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
@RequirePermissions('viewAnalytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: 'Usage stats: active users, quiz attempts, book reads, revenue' })
  @Get('usage')
  async getUsageStats() {
    return this.analyticsService.getUsageStats();
  }

  @ApiOperation({ summary: 'Subject-wise quiz performance breakdown' })
  @Get('subject-performance')
  async getSubjectPerformance() {
    return this.analyticsService.getSubjectPerformance();
  }
}

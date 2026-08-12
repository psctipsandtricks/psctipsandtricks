import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * Separate from AnalyticsController because that one is gated to ADMIN/STAFF
 * with `viewAnalytics` at the class level. These routes are scoped to the
 * caller's own records, so any signed-in user may read them — keeping them in
 * their own controller means the admin gate can never be loosened by accident.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class StudentAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: "Current student's personal study dashboard" })
  @Get('me/dashboard')
  async getMyDashboard(@Request() req: any) {
    return this.analyticsService.getStudentDashboard(req.user.id);
  }
}

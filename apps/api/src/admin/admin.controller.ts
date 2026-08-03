import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get administrative dashboard metrics and analytics' })
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardAnalytics();
  }
}

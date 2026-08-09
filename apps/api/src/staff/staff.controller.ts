import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'Invite a new staff member with permissions (Super Admin only)' })
  @Post('invite')
  async invite(@Request() req: any, @Body() dto: InviteStaffDto) {
    return this.staffService.invite(dto, req.user.id);
  }

  @ApiOperation({ summary: 'List all staff members and their permissions (Super Admin only)' })
  @Get()
  async findAll() {
    return this.staffService.findAll();
  }

  @ApiOperation({ summary: 'Update a staff member\'s permission matrix (Super Admin only)' })
  @Patch(':id/permissions')
  async updatePermissions(@Param('id') id: string, @Body() dto: UpdatePermissionsDto) {
    return this.staffService.updatePermissions(id, dto);
  }

  @ApiOperation({ summary: 'Suspend a staff member (Super Admin only)' })
  @Patch(':id/suspend')
  async suspend(@Param('id') id: string) {
    return this.staffService.setSuspended(id, true);
  }

  @ApiOperation({ summary: 'Reactivate a suspended staff member (Super Admin only)' })
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return this.staffService.setSuspended(id, false);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { ResetStaffPasswordDto } from './dto/reset-password.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'Create a new staff or admin user' })
  @Post()
  async create(@Request() req: any, @Body() dto: CreateStaffDto) {
    return this.staffService.create(dto, req.user.id);
  }

  @ApiOperation({ summary: 'List all staff members and administrators' })
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.findAll({
      search,
      role,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Update staff member profile & status' })
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, dto, req.user.id);
  }

  @ApiOperation({ summary: 'Update a staff member\'s granular permission matrix' })
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.staffService.updatePermissions(id, dto);
  }

  @ApiOperation({ summary: 'Reset staff account password' })
  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.staffService.resetPassword(id, dto.password);
  }

  @ApiOperation({ summary: 'Suspend a staff member' })
  @Patch(':id/suspend')
  async suspend(@Request() req: any, @Param('id') id: string) {
    return this.staffService.setSuspended(id, true, req.user.id);
  }

  @ApiOperation({ summary: 'Reactivate a suspended staff member' })
  @Patch(':id/reactivate')
  async reactivate(@Request() req: any, @Param('id') id: string) {
    return this.staffService.setSuspended(id, false, req.user.id);
  }

  @ApiOperation({ summary: 'Delete a staff account' })
  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.staffService.delete(id, req.user.id);
  }
}

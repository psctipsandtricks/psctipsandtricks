import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get all users (Admin / Staff with manage_users)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageUsers')
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'Create a student account (Admin / Staff with manage_users)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageUsers')
  @Post()
  async create(@Body() dto: AdminCreateUserDto) {
    return this.usersService.createStudent(dto);
  }

  @ApiOperation({ summary: 'Get user profile by ID' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Update user profile (self only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.updateProfile(id, dto);
  }

  @ApiOperation({ summary: 'Upload/replace a profile picture (self only)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/avatar')
  async uploadAvatar(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile picture');
    }
    return this.usersService.uploadAvatar(id, file);
  }

  @ApiOperation({ summary: 'Remove the current profile picture (self only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id/avatar')
  async removeAvatar(@Request() req: any, @Param('id') id: string) {
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile picture');
    }
    return this.usersService.removeAvatar(id);
  }

  @ApiOperation({ summary: 'Update a user account as an admin/staff (Admin / Staff with manage_users)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageUsers')
  @Patch(':id/admin')
  async adminUpdate(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.usersService.adminUpdate(id, dto);
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MockTestsService } from './mock-tests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole, MockTestStatus } from '@prisma/client';
import { CreateMockTestDto } from './dto/create-mock-test.dto';
import { SubmitQuizDto } from '../quizzes/dto/submit-quiz.dto';

@ApiTags('Mock Tests')
@Controller('mock-tests')
export class MockTestsController {
  constructor(private readonly mockTestsService: MockTestsService) {}

  @ApiOperation({ summary: 'List mock tests, optionally filtered by status' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(@Request() req: any, @Query('status') status?: MockTestStatus) {
    return this.mockTestsService.findAll(status, req.user);
  }

  @ApiOperation({ summary: "Get the current user's mock test participation records" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('my-attempts')
  async getMyAttempts(@Request() req: any) {
    return this.mockTestsService.getMyAttempts(req.user.id);
  }

  @ApiOperation({ summary: 'Get mock test details with current rank list' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.mockTestsService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Get the live rank list for a mock test' })
  @Get(':id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    return this.mockTestsService.getLeaderboard(id);
  }

  @ApiOperation({ summary: 'Schedule a new mock test (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Post()
  async create(@Request() req: any, @Body() dto: CreateMockTestDto) {
    return this.mockTestsService.create(dto, req.user.id);
  }

  @ApiOperation({ summary: 'Update a scheduled mock test (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.mockTestsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a scheduled mock test (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.mockTestsService.remove(id);
  }

  @ApiOperation({ summary: 'Join a mock test at its scheduled time' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async join(@Request() req: any, @Param('id') id: string) {
    return this.mockTestsService.join(id, req.user);
  }

  @ApiOperation({ summary: 'Submit mock test responses' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  async submit(@Request() req: any, @Param('id') id: string, @Body() dto: SubmitQuizDto) {
    return this.mockTestsService.submit(id, req.user, dto);
  }
}

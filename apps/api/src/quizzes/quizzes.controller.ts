import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @ApiOperation({ summary: 'List all quizzes and live mock tests' })
  @ApiQuery({ name: 'publishedOnly', required: false, type: Boolean })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(@Request() req: any, @Query('publishedOnly') publishedOnly?: string) {
    const isPublishedOnly = publishedOnly === 'true' || publishedOnly === '1';
    return this.quizzesService.findAll(isPublishedOnly, req.user);
  }

  @ApiOperation({ summary: 'Get quiz details by ID with questions' })
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.quizzesService.findOne(id, req.user);
  }

  @ApiOperation({ summary: 'Get quiz leaderboard/rank list' })
  @Get(':id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    return this.quizzesService.getLeaderboard(id);
  }

  @ApiOperation({ summary: 'Create a new quiz (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Post()
  async create(@Body() dto: CreateQuizDto) {
    return this.quizzesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a quiz (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.quizzesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a quiz (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.quizzesService.remove(id);
  }

  @ApiOperation({ summary: 'Get current student quiz attempt history' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history/me')
  async getStudentHistory(@Request() req: any) {
    return this.quizzesService.getStudentHistory(req.user.id);
  }

  @ApiOperation({ summary: 'Get all student quiz attempts (Admin / Staff)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Get('admin/attempts')
  async getAdminHistory(@Query('quizId') quizId?: string, @Query('userId') userId?: string) {
    return this.quizzesService.getAdminHistory(quizId, userId);
  }

  @ApiOperation({ summary: 'Start or resume a quiz attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/attempts/start')
  async startAttempt(@Request() req: any, @Param('id') id: string) {
    return this.quizzesService.startAttempt(req.user, id);
  }

  @ApiOperation({ summary: 'Get active IN_PROGRESS quiz attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/attempts/active')
  async getActiveAttempt(@Request() req: any, @Param('id') id: string) {
    return this.quizzesService.getActiveAttempt(req.user.id, id);
  }

  @ApiOperation({ summary: 'Submit quiz responses for a specific attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  async submitQuiz(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitQuizDto,
    @Query('attemptId') attemptId?: string,
  ) {
    return this.quizzesService.submitQuiz(req.user, id, dto, attemptId);
  }
}

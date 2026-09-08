import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { PauseQuizDto } from './dto/pause-quiz.dto';
import { CreateQuizFolderDto, UpdateQuizFolderDto } from './dto/quiz-folder.dto';
import { ReorderDto } from '../common/dto/library-folder.dto';
import { MoveQuizDto } from './dto/move-quiz.dto';

const MANAGE_QUIZZES_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Quizzes')
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  // --- Folders ---

  @ApiOperation({ summary: 'List all quiz folders with quiz counts' })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('folders')
  async listFolders(@Request() req: any, @Query('parentId') parentId?: string) {
    return this.quizzesService.listFolders(req.user, parentId);
  }

  @ApiOperation({ summary: 'Create a quiz folder (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Post('folders')
  async createFolder(@Body() dto: CreateQuizFolderDto) {
    return this.quizzesService.createFolder(dto);
  }

  @ApiOperation({ summary: 'Reorder quiz folders (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Patch('folders/reorder')
  async reorderFolders(@Body() dto: ReorderDto) {
    return this.quizzesService.reorderFolders(dto);
  }

  @ApiOperation({ summary: 'Update a quiz folder (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Patch('folders/:id')
  async updateFolder(@Param('id') id: string, @Body() dto: UpdateQuizFolderDto) {
    return this.quizzesService.updateFolder(id, dto);
  }

  @ApiOperation({ summary: 'Delete a quiz folder (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Delete('folders/:id')
  async removeFolder(@Param('id') id: string) {
    return this.quizzesService.deleteFolder(id);
  }

  @ApiOperation({ summary: 'List all quizzes and live mock tests' })
  @ApiQuery({ name: 'publishedOnly', required: false, type: Boolean })
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Request() req: any,
    @Query('publishedOnly') publishedOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('folder') folder?: string,
    @Query('access') access?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    const isPublishedOnly = publishedOnly === 'true' || publishedOnly === '1';
    return this.quizzesService.findAll(
      {
        publishedOnly: isPublishedOnly,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search,
        folder,
        access,
        status,
        sort,
      },
      req.user,
    );
  }

  // Declared ahead of `:id` so the literal segment wins — `@Patch(':id')` would
  // otherwise swallow this as a quiz whose id is "reorder".
  @ApiOperation({ summary: 'Reorder quizzes within a folder (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Patch('reorder')
  async reorderQuizzes(@Body() dto: ReorderDto) {
    return this.quizzesService.reorderQuizzes(dto);
  }

  @ApiOperation({ summary: 'Move a quiz to an absolute position in its folder (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_QUIZZES_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Patch(':id/move')
  async moveQuiz(@Param('id') id: string, @Body() dto: MoveQuizDto) {
    return this.quizzesService.moveQuizToPosition(id, dto.position);
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

  @ApiOperation({ summary: 'Upload an image for a quiz (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @UseInterceptors(FileInterceptor('file'))
  @Post('upload-image')
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.quizzesService.uploadImage(file);
  }

  @ApiOperation({ summary: 'Upload/replace image for a specific quiz (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/image')
  async uploadQuizImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.quizzesService.uploadQuizImage(id, file);
  }

  @ApiOperation({ summary: 'Remove quiz image (Admin / Staff with manage_quizzes)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageQuizzes')
  @Delete(':id/image')
  async removeQuizImage(@Param('id') id: string) {
    return this.quizzesService.removeQuizImage(id);
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
  async getStudentHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.quizzesService.getStudentHistory(req.user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get the full question-by-question review for one submitted attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('attempts/:attemptId/review')
  async getAttemptReview(@Request() req: any, @Param('attemptId') attemptId: string) {
    return this.quizzesService.getAttemptReview(req.user, attemptId);
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

  /**
   * Where the student stands on every quiz they have opened, so the hub can
   * label each card Start / Resume / Retake and show a completed count.
   *
   * Two segments deep, so `@Get(':id')` above cannot claim it.
   */
  @ApiOperation({ summary: "This student's completed and in-progress attempts, per quiz" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('attempts/summary')
  async getAttemptSummary(@Request() req: any) {
    return this.quizzesService.getAttemptSummary(req.user.id);
  }

  @ApiOperation({
    summary:
      'Start or resume a quiz attempt. `restart=true` abandons an unfinished attempt and begins again from the first question.',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/attempts/start')
  async startAttempt(
    @Request() req: any,
    @Param('id') id: string,
    @Query('restart') restart?: string,
  ) {
    return this.quizzesService.startAttempt(req.user, id, restart === 'true' || restart === '1');
  }

  @ApiOperation({ summary: 'Get active IN_PROGRESS quiz attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/attempts/active')
  async getActiveAttempt(@Request() req: any, @Param('id') id: string) {
    return this.quizzesService.getActiveAttempt(req.user.id, id);
  }

  @ApiOperation({ summary: 'Pause and save active IN_PROGRESS quiz attempt' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/attempts/pause')
  async pauseAttempt(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: PauseQuizDto,
    @Query('attemptId') attemptId?: string,
  ) {
    return this.quizzesService.pauseAttempt(req.user.id, id, dto, attemptId);
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

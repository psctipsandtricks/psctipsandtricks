import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

const MANAGE_VIDEOS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];
const VIDEO_PDF_UPLOAD_LIMITS = { fileSize: 50 * 1024 * 1024 };

@ApiTags('Videos')
@ApiBearerAuth()
@Controller('videos')
@UseGuards(OptionalJwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  // --- Video Folders (Recursive Tree) ---

  @ApiOperation({ summary: 'List video folders (optionally filtered by parentId)' })
  @Get('folders')
  async listFolders(@Request() req: any, @Query('parentId') parentId?: string) {
    return this.videosService.listFolders(req.user, parentId);
  }

  @ApiOperation({ summary: 'Get a single video folder with its subfolders and videos' })
  @Get('folders/:id')
  async getFolder(@Request() req: any, @Param('id') id: string) {
    return this.videosService.findFolder(id, req.user);
  }

  @ApiOperation({ summary: 'Create a video folder or subfolder (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('folders')
  async createFolder(@Body() dto: { name: string; parentId?: string | null; description?: string; isActive?: boolean }) {
    return this.videosService.createFolder(dto);
  }

  @ApiOperation({ summary: 'Update a video folder (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('folders/:id')
  async updateFolder(
    @Param('id') id: string,
    @Body() dto: { name?: string; parentId?: string | null; description?: string; isActive?: boolean; orderIndex?: number },
  ) {
    return this.videosService.updateFolder(id, dto);
  }

  @ApiOperation({ summary: 'Delete a video folder (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('folders/:id')
  async removeFolder(@Param('id') id: string) {
    return this.videosService.removeFolder(id);
  }

  @ApiOperation({ summary: 'Reorder video folders (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('folders/reorder')
  async reorderFolders(@Body() dto: ReorderDto) {
    return this.videosService.reorderFolders(dto);
  }

  // --- Legacy Compatibility Routes ---

  @Get('exams')
  async listExams(@Request() req: any) {
    return this.videosService.listExams(req.user);
  }

  @Get('exams/:examId')
  async getExam(@Request() req: any, @Param('examId') examId: string) {
    return this.videosService.findExam(examId, req.user);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('exams')
  async createExam(@Body() dto: CreateLibraryFolderDto) {
    return this.videosService.createExam(dto);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/reorder')
  async reorderExams(@Body() dto: ReorderDto) {
    return this.videosService.reorderExams(dto);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/:examId')
  async updateExam(@Param('examId') examId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.videosService.updateExam(examId, dto);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('exams/:examId')
  async removeExam(@Param('examId') examId: string) {
    return this.videosService.removeExam(examId);
  }

  @Get('exams/:examId/chapters')
  async listChapters(@Request() req: any, @Param('examId') examId: string) {
    return this.videosService.listChapters(examId, req.user);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('exams/:examId/chapters')
  async createChapter(@Param('examId') examId: string, @Body() dto: CreateLibraryFolderDto) {
    return this.videosService.createChapter(examId, dto);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/:examId/chapters/reorder')
  async reorderChapters(@Param('examId') examId: string, @Body() dto: ReorderDto) {
    return this.videosService.reorderChapters(examId, dto);
  }

  @Get('chapters/:chapterId')
  async getChapter(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.videosService.findChapter(chapterId, req.user);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('chapters/:chapterId')
  async updateChapter(@Param('chapterId') chapterId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.videosService.updateChapter(chapterId, dto);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('chapters/:chapterId')
  async removeChapter(@Param('chapterId') chapterId: string) {
    return this.videosService.removeChapter(chapterId);
  }

  @Get('chapters/:chapterId/videos')
  async listChapterVideos(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.videosService.listVideos({ chapterId }, req.user);
  }

  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('chapters/:chapterId/videos')
  async createChapterVideo(@Param('chapterId') chapterId: string, @Body() dto: CreateVideoDto) {
    return this.videosService.createVideo({ ...dto, chapterId });
  }

  // --- Videos ---

  @ApiOperation({ summary: 'List videos (optionally by folderId, chapterId, or search query)' })
  @Get()
  async listVideos(
    @Request() req: any,
    @Query('folderId') folderId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('search') search?: string,
  ) {
    return this.videosService.listVideos({ folderId, chapterId, search }, req.user);
  }

  @ApiOperation({ summary: 'Create a video inside any folder (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post()
  async createVideo(@Body() dto: CreateVideoDto) {
    return this.videosService.createVideo(dto);
  }

  @ApiOperation({ summary: 'Update a video (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch(':id')
  async updateVideo(@Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.videosService.updateVideo(id, dto);
  }

  @ApiOperation({ summary: 'Delete a video (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete(':id')
  async removeVideo(@Param('id') id: string) {
    return this.videosService.removeVideo(id);
  }

  @ApiOperation({ summary: 'Attach a PDF document to a video (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: VIDEO_PDF_UPLOAD_LIMITS }))
  @Post(':id/pdf')
  async uploadVideoPdf(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.videosService.uploadVideoPdf(id, file);
  }

  @ApiOperation({ summary: 'Remove the attached PDF from a video (Admin / Staff)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete(':id/pdf')
  async removeVideoPdf(@Param('id') id: string) {
    return this.videosService.removeVideoPdf(id);
  }

  @ApiOperation({ summary: 'Get a single video' })
  @Get(':id')
  async getVideo(@Request() req: any, @Param('id') id: string) {
    return this.videosService.findVideo(id, req.user);
  }
}

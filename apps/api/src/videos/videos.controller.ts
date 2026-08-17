import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

const MANAGE_VIDEOS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

/**
 * Every route requires a signed-in user: the library is free, but not public.
 * Reads are open to any student; writes need ADMIN, or STAFF holding
 * `manageVideos`.
 */
@ApiTags('Videos')
@ApiBearerAuth()
@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  // --- Exams ---

  @ApiOperation({ summary: 'List exam folders in the video library' })
  @Get('exams')
  async listExams(@Request() req: any) {
    return this.videosService.listExams(req.user);
  }

  @ApiOperation({ summary: 'Get a single exam folder' })
  @Get('exams/:examId')
  async getExam(@Request() req: any, @Param('examId') examId: string) {
    return this.videosService.findExam(examId, req.user);
  }

  @ApiOperation({ summary: 'Create an exam folder (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('exams')
  async createExam(@Body() dto: CreateLibraryFolderDto) {
    return this.videosService.createExam(dto);
  }

  @ApiOperation({ summary: 'Reorder exam folders (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/reorder')
  async reorderExams(@Body() dto: ReorderDto) {
    return this.videosService.reorderExams(dto);
  }

  @ApiOperation({ summary: 'Update an exam folder (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/:examId')
  async updateExam(@Param('examId') examId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.videosService.updateExam(examId, dto);
  }

  @ApiOperation({ summary: 'Delete an exam folder and everything inside it (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('exams/:examId')
  async removeExam(@Param('examId') examId: string) {
    return this.videosService.removeExam(examId);
  }

  // --- Chapters ---

  @ApiOperation({ summary: 'List chapter folders inside an exam' })
  @Get('exams/:examId/chapters')
  async listChapters(@Request() req: any, @Param('examId') examId: string) {
    return this.videosService.listChapters(examId, req.user);
  }

  @ApiOperation({ summary: 'Add a chapter folder to an exam (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('exams/:examId/chapters')
  async createChapter(@Param('examId') examId: string, @Body() dto: CreateLibraryFolderDto) {
    return this.videosService.createChapter(examId, dto);
  }

  @ApiOperation({ summary: 'Reorder chapter folders within an exam (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('exams/:examId/chapters/reorder')
  async reorderChapters(@Param('examId') examId: string, @Body() dto: ReorderDto) {
    return this.videosService.reorderChapters(examId, dto);
  }

  @ApiOperation({ summary: 'Get a single chapter folder' })
  @Get('chapters/:chapterId')
  async getChapter(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.videosService.findChapter(chapterId, req.user);
  }

  @ApiOperation({ summary: 'Update a chapter folder (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('chapters/:chapterId')
  async updateChapter(@Param('chapterId') chapterId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.videosService.updateChapter(chapterId, dto);
  }

  @ApiOperation({ summary: 'Delete a chapter folder and its videos (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('chapters/:chapterId')
  async removeChapter(@Param('chapterId') chapterId: string) {
    return this.videosService.removeChapter(chapterId);
  }

  // --- Videos ---

  @ApiOperation({ summary: 'List videos inside a chapter folder' })
  @Get('chapters/:chapterId/videos')
  async listVideos(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.videosService.listVideos(chapterId, req.user);
  }

  @ApiOperation({ summary: 'Add a YouTube video to a chapter (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Post('chapters/:chapterId/videos')
  async createVideo(@Param('chapterId') chapterId: string, @Body() dto: CreateVideoDto) {
    return this.videosService.createVideo(chapterId, dto);
  }

  @ApiOperation({ summary: 'Reorder videos within a chapter (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('chapters/:chapterId/videos/reorder')
  async reorderVideos(@Param('chapterId') chapterId: string, @Body() dto: ReorderDto) {
    return this.videosService.reorderVideos(chapterId, dto);
  }

  @ApiOperation({ summary: 'Get a single video' })
  @Get('items/:videoId')
  async getVideo(@Request() req: any, @Param('videoId') videoId: string) {
    return this.videosService.findVideo(videoId, req.user);
  }

  @ApiOperation({ summary: 'Update a video (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Patch('items/:videoId')
  async updateVideo(@Param('videoId') videoId: string, @Body() dto: UpdateVideoDto) {
    return this.videosService.updateVideo(videoId, dto);
  }

  @ApiOperation({ summary: 'Delete a video (Admin / Staff with manage_videos)' })
  @UseGuards(...MANAGE_VIDEOS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageVideos')
  @Delete('items/:videoId')
  async removeVideo(@Param('videoId') videoId: string) {
    return this.videosService.removeVideo(videoId);
  }
}

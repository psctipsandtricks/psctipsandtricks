import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { ReorderTopicsDto } from './dto/reorder-topics.dto';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { UpdateSubtopicDto } from './dto/update-subtopic.dto';
import { ReorderSubtopicsDto } from './dto/reorder-subtopics.dto';

const MANAGE_BOOKS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];
const AUDIO_UPLOAD_LIMITS = { fileSize: 45 * 1024 * 1024 }; // 45MB, matches the "Max: 45MB" audio field hint
const PDF_UPLOAD_LIMITS = { fileSize: 20 * 1024 * 1024 }; // 20MB, matches the "Max: 20MB" PDF field hint

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @ApiOperation({ summary: 'List all published e-books' })
  @Get()
  async findAll() {
    return this.booksService.findAll();
  }

  @ApiOperation({ summary: 'Get details of a specific e-book, including chapters' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new e-book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Post()
  async create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @ApiOperation({ summary: 'Update e-book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.booksService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete e-book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.booksService.remove(id);
  }

  @ApiOperation({ summary: 'Upload/replace cover image for a book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/cover')
  async uploadCover(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadCover(id, file);
  }

  // --- Chapters ---

  @ApiOperation({ summary: 'List chapters for a book' })
  @Get(':id/chapters')
  async listChapters(@Param('id') id: string) {
    return this.booksService.listChapters(id);
  }

  @ApiOperation({ summary: 'Add a chapter to a book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Post(':id/chapters')
  async addChapter(@Param('id') id: string, @Body() dto: CreateChapterDto) {
    return this.booksService.addChapter(id, dto);
  }

  @ApiOperation({ summary: 'Reorder chapters within a book (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch(':id/chapters/reorder')
  async reorderChapters(@Param('id') id: string, @Body() dto: ReorderChaptersDto) {
    return this.booksService.reorderChapters(id, dto);
  }

  @ApiOperation({ summary: 'Get a single chapter, including its topics' })
  @Get('chapters/:chapterId')
  async getChapter(@Param('chapterId') chapterId: string) {
    return this.booksService.findChapter(chapterId);
  }

  @ApiOperation({ summary: 'Update a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch('chapters/:chapterId')
  async updateChapter(@Param('chapterId') chapterId: string, @Body() dto: UpdateChapterDto) {
    return this.booksService.updateChapter(chapterId, dto);
  }

  @ApiOperation({ summary: 'Delete a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Delete('chapters/:chapterId')
  async removeChapter(@Param('chapterId') chapterId: string) {
    return this.booksService.removeChapter(chapterId);
  }

  @ApiOperation({ summary: 'Upload/replace audio for a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: AUDIO_UPLOAD_LIMITS }))
  @Post('chapters/:chapterId/audio')
  async uploadChapterAudio(@Param('chapterId') chapterId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadChapterAudio(chapterId, file);
  }

  @ApiOperation({ summary: 'Upload/replace PDF for a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: PDF_UPLOAD_LIMITS }))
  @Post('chapters/:chapterId/pdf')
  async uploadChapterPdf(@Param('chapterId') chapterId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadChapterPdf(chapterId, file);
  }

  // --- Topics ---

  @ApiOperation({ summary: 'List topics for a chapter' })
  @Get('chapters/:chapterId/topics')
  async listTopics(@Param('chapterId') chapterId: string) {
    return this.booksService.listTopics(chapterId);
  }

  @ApiOperation({ summary: 'Add a topic to a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Post('chapters/:chapterId/topics')
  async addTopic(@Param('chapterId') chapterId: string, @Body() dto: CreateTopicDto) {
    return this.booksService.addTopic(chapterId, dto);
  }

  @ApiOperation({ summary: 'Reorder topics within a chapter (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch('chapters/:chapterId/topics/reorder')
  async reorderTopics(@Param('chapterId') chapterId: string, @Body() dto: ReorderTopicsDto) {
    return this.booksService.reorderTopics(chapterId, dto);
  }

  @ApiOperation({ summary: 'Get a single topic, including its subtopics' })
  @Get('topics/:topicId')
  async getTopic(@Param('topicId') topicId: string) {
    return this.booksService.findTopic(topicId);
  }

  @ApiOperation({ summary: 'Update a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch('topics/:topicId')
  async updateTopic(@Param('topicId') topicId: string, @Body() dto: UpdateTopicDto) {
    return this.booksService.updateTopic(topicId, dto);
  }

  @ApiOperation({ summary: 'Delete a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Delete('topics/:topicId')
  async removeTopic(@Param('topicId') topicId: string) {
    return this.booksService.removeTopic(topicId);
  }

  @ApiOperation({ summary: 'Upload/replace audio for a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: AUDIO_UPLOAD_LIMITS }))
  @Post('topics/:topicId/audio')
  async uploadTopicAudio(@Param('topicId') topicId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadTopicAudio(topicId, file);
  }

  @ApiOperation({ summary: 'Upload/replace PDF for a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: PDF_UPLOAD_LIMITS }))
  @Post('topics/:topicId/pdf')
  async uploadTopicPdf(@Param('topicId') topicId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadTopicPdf(topicId, file);
  }

  // --- Subtopics ---

  @ApiOperation({ summary: 'List subtopics for a topic' })
  @Get('topics/:topicId/subtopics')
  async listSubtopics(@Param('topicId') topicId: string) {
    return this.booksService.listSubtopics(topicId);
  }

  @ApiOperation({ summary: 'Add a subtopic to a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Post('topics/:topicId/subtopics')
  async addSubtopic(@Param('topicId') topicId: string, @Body() dto: CreateSubtopicDto) {
    return this.booksService.addSubtopic(topicId, dto);
  }

  @ApiOperation({ summary: 'Reorder subtopics within a topic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch('topics/:topicId/subtopics/reorder')
  async reorderSubtopics(@Param('topicId') topicId: string, @Body() dto: ReorderSubtopicsDto) {
    return this.booksService.reorderSubtopics(topicId, dto);
  }

  @ApiOperation({ summary: 'Update a subtopic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Patch('subtopics/:subtopicId')
  async updateSubtopic(@Param('subtopicId') subtopicId: string, @Body() dto: UpdateSubtopicDto) {
    return this.booksService.updateSubtopic(subtopicId, dto);
  }

  @ApiOperation({ summary: 'Delete a subtopic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @Delete('subtopics/:subtopicId')
  async removeSubtopic(@Param('subtopicId') subtopicId: string) {
    return this.booksService.removeSubtopic(subtopicId);
  }

  @ApiOperation({ summary: 'Upload/replace audio for a subtopic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: AUDIO_UPLOAD_LIMITS }))
  @Post('subtopics/:subtopicId/audio')
  async uploadSubtopicAudio(@Param('subtopicId') subtopicId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadSubtopicAudio(subtopicId, file);
  }

  @ApiOperation({ summary: 'Upload/replace PDF for a subtopic (Admin / Staff with manage_books)' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_BOOKS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageBooks')
  @UseInterceptors(FileInterceptor('file', { limits: PDF_UPLOAD_LIMITS }))
  @Post('subtopics/:subtopicId/pdf')
  async uploadSubtopicPdf(@Param('subtopicId') subtopicId: string, @UploadedFile() file: Express.Multer.File) {
    return this.booksService.uploadSubtopicPdf(subtopicId, file);
  }
}

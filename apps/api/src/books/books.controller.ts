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

const MANAGE_BOOKS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

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
  @UseInterceptors(FileInterceptor('file'))
  @Post('chapters/:chapterId/audio')
  async uploadChapterAudio(
    @Param('chapterId') chapterId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.booksService.uploadChapterAudio(chapterId, file);
  }
}

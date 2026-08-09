import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpsertProgressDto } from './dto/upsert-progress.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@ApiTags('Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @ApiOperation({ summary: 'Get reading progress for the current user' })
  @Get('progress')
  async getProgress(@Request() req: any, @Query('bookId') bookId?: string) {
    return this.libraryService.getProgress(req.user.id, bookId);
  }

  @ApiOperation({ summary: 'Upsert reading progress for a book/chapter' })
  @Post('progress')
  async upsertProgress(@Request() req: any, @Body() dto: UpsertProgressDto) {
    return this.libraryService.upsertProgress(req.user.id, dto);
  }

  @ApiOperation({ summary: 'List bookmarks for the current user' })
  @Get('bookmarks')
  async getBookmarks(@Request() req: any) {
    return this.libraryService.getBookmarks(req.user.id);
  }

  @ApiOperation({ summary: 'Add a bookmark (question or chapter)' })
  @Post('bookmarks')
  async addBookmark(@Request() req: any, @Body() dto: CreateBookmarkDto) {
    return this.libraryService.addBookmark(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Remove a bookmark' })
  @Delete('bookmarks/:id')
  async removeBookmark(@Request() req: any, @Param('id') id: string) {
    return this.libraryService.removeBookmark(req.user.id, id);
  }
}

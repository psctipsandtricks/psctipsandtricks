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
import { PdfsService } from './pdfs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreatePdfDocumentDto, UpdatePdfDocumentDto } from './dto/pdf-document.dto';

const MANAGE_PDFS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];
const PDF_UPLOAD_LIMITS = { fileSize: 50 * 1024 * 1024 };

@ApiTags('PDFs')
@ApiBearerAuth()
@Controller('pdfs')
@UseGuards(JwtAuthGuard)
export class PdfsController {
  constructor(private readonly pdfsService: PdfsService) {}

  // --- PDF Folders (Recursive Tree) ---

  @ApiOperation({ summary: 'List PDF folders (optionally filtered by parentId)' })
  @Get('folders')
  async listFolders(@Request() req: any, @Query('parentId') parentId?: string) {
    return this.pdfsService.listFolders(req.user, parentId);
  }

  @ApiOperation({ summary: 'Get a single PDF folder with its subfolders and documents' })
  @Get('folders/:id')
  async getFolder(@Request() req: any, @Param('id') id: string) {
    return this.pdfsService.findFolder(id, req.user);
  }

  @ApiOperation({ summary: 'Create a PDF folder or subfolder (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('folders')
  async createFolder(@Body() dto: { name: string; parentId?: string | null; description?: string; isActive?: boolean }) {
    return this.pdfsService.createFolder(dto);
  }

  @ApiOperation({ summary: 'Update a PDF folder (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('folders/:id')
  async updateFolder(
    @Param('id') id: string,
    @Body() dto: { name?: string; parentId?: string | null; description?: string; isActive?: boolean; orderIndex?: number },
  ) {
    return this.pdfsService.updateFolder(id, dto);
  }

  @ApiOperation({ summary: 'Delete a PDF folder (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('folders/:id')
  async removeFolder(@Param('id') id: string) {
    return this.pdfsService.removeFolder(id);
  }

  @ApiOperation({ summary: 'Reorder PDF folders (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('folders/reorder')
  async reorderFolders(@Body() dto: ReorderDto) {
    return this.pdfsService.reorderFolders(dto);
  }

  // --- PDF Documents ---

  @ApiOperation({ summary: 'List PDF documents (optionally by folderId, chapterId, or search query)' })
  @Get()
  async listDocuments(
    @Request() req: any,
    @Query('folderId') folderId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('search') search?: string,
  ) {
    return this.pdfsService.listDocuments({ folderId, chapterId, search }, req.user);
  }

  @ApiOperation({ summary: 'Get a single PDF document' })
  @Get(':id')
  async getDocument(@Request() req: any, @Param('id') id: string) {
    return this.pdfsService.findDocument(id, req.user);
  }

  @ApiOperation({ summary: 'Create a PDF document inside any folder (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post()
  async createDocument(@Body() dto: CreatePdfDocumentDto) {
    return this.pdfsService.createDocument(dto);
  }

  @ApiOperation({ summary: 'Update a PDF document (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch(':id')
  async updateDocument(@Param('id') id: string, @Body() dto: UpdatePdfDocumentDto) {
    return this.pdfsService.updateDocument(id, dto);
  }

  @ApiOperation({ summary: 'Delete a PDF document (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete(':id')
  async removeDocument(@Param('id') id: string) {
    return this.pdfsService.removeDocument(id);
  }

  @ApiOperation({ summary: 'Upload file to a PDF document (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: PDF_UPLOAD_LIMITS }))
  @Post(':id/file')
  async uploadPdfFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.pdfsService.uploadPdfFile(id, file);
  }

  @ApiOperation({ summary: 'Remove file from a PDF document (Admin / Staff)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete(':id/file')
  async removePdfFile(@Param('id') id: string) {
    return this.pdfsService.removePdfFile(id);
  }

  // --- Legacy Compatibility Routes ---

  @Get('exams')
  async listExams(@Request() req: any) {
    return this.pdfsService.listExams(req.user);
  }

  @Get('exams/:examId')
  async getExam(@Request() req: any, @Param('examId') examId: string) {
    return this.pdfsService.findExam(examId, req.user);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('exams')
  async createExam(@Body() dto: CreateLibraryFolderDto) {
    return this.pdfsService.createExam(dto);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/reorder')
  async reorderExams(@Body() dto: ReorderDto) {
    return this.pdfsService.reorderExams(dto);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/:examId')
  async updateExam(@Param('examId') examId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.pdfsService.updateExam(examId, dto);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('exams/:examId')
  async removeExam(@Param('examId') examId: string) {
    return this.pdfsService.removeExam(examId);
  }

  @Get('exams/:examId/chapters')
  async listChapters(@Request() req: any, @Param('examId') examId: string) {
    return this.pdfsService.listChapters(examId, req.user);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('exams/:examId/chapters')
  async createChapter(@Param('examId') examId: string, @Body() dto: CreateLibraryFolderDto) {
    return this.pdfsService.createChapter(examId, dto);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/:examId/chapters/reorder')
  async reorderChapters(@Param('examId') examId: string, @Body() dto: ReorderDto) {
    return this.pdfsService.reorderChapters(examId, dto);
  }

  @Get('chapters/:chapterId')
  async getChapter(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.pdfsService.findChapter(chapterId, req.user);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('chapters/:chapterId')
  async updateChapter(@Param('chapterId') chapterId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.pdfsService.updateChapter(chapterId, dto);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('chapters/:chapterId')
  async removeChapter(@Param('chapterId') chapterId: string) {
    return this.pdfsService.removeChapter(chapterId);
  }

  @Get('chapters/:chapterId/documents')
  async listChapterDocuments(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.pdfsService.listDocuments({ chapterId }, req.user);
  }

  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('chapters/:chapterId/documents')
  async createChapterDocument(@Param('chapterId') chapterId: string, @Body() dto: CreatePdfDocumentDto) {
    return this.pdfsService.createDocument({ ...dto, chapterId });
  }
}

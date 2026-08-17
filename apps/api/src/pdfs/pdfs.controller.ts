import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
// Study material regularly runs to full solved-paper collections, so the cap is
// well above the 20MB used for a single book chapter's PDF.
const PDF_UPLOAD_LIMITS = { fileSize: 50 * 1024 * 1024 }; // 50MB, matches the "Max: 50MB" field hint

/**
 * Every route requires a signed-in user: the library is free, but not public.
 * Reads are open to any student; writes need ADMIN, or STAFF holding
 * `managePdfs`.
 */
@ApiTags('PDFs')
@ApiBearerAuth()
@Controller('pdfs')
@UseGuards(JwtAuthGuard)
export class PdfsController {
  constructor(private readonly pdfsService: PdfsService) {}

  // --- Exams ---

  @ApiOperation({ summary: 'List exam folders in the PDF library' })
  @Get('exams')
  async listExams(@Request() req: any) {
    return this.pdfsService.listExams(req.user);
  }

  @ApiOperation({ summary: 'Get a single exam folder' })
  @Get('exams/:examId')
  async getExam(@Request() req: any, @Param('examId') examId: string) {
    return this.pdfsService.findExam(examId, req.user);
  }

  @ApiOperation({ summary: 'Create an exam folder (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('exams')
  async createExam(@Body() dto: CreateLibraryFolderDto) {
    return this.pdfsService.createExam(dto);
  }

  @ApiOperation({ summary: 'Reorder exam folders (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/reorder')
  async reorderExams(@Body() dto: ReorderDto) {
    return this.pdfsService.reorderExams(dto);
  }

  @ApiOperation({ summary: 'Update an exam folder (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/:examId')
  async updateExam(@Param('examId') examId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.pdfsService.updateExam(examId, dto);
  }

  @ApiOperation({ summary: 'Delete an exam folder and everything inside it (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('exams/:examId')
  async removeExam(@Param('examId') examId: string) {
    return this.pdfsService.removeExam(examId);
  }

  // --- Chapters ---

  @ApiOperation({ summary: 'List chapter folders inside an exam' })
  @Get('exams/:examId/chapters')
  async listChapters(@Request() req: any, @Param('examId') examId: string) {
    return this.pdfsService.listChapters(examId, req.user);
  }

  @ApiOperation({ summary: 'Add a chapter folder to an exam (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('exams/:examId/chapters')
  async createChapter(@Param('examId') examId: string, @Body() dto: CreateLibraryFolderDto) {
    return this.pdfsService.createChapter(examId, dto);
  }

  @ApiOperation({ summary: 'Reorder chapter folders within an exam (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('exams/:examId/chapters/reorder')
  async reorderChapters(@Param('examId') examId: string, @Body() dto: ReorderDto) {
    return this.pdfsService.reorderChapters(examId, dto);
  }

  @ApiOperation({ summary: 'Get a single chapter folder' })
  @Get('chapters/:chapterId')
  async getChapter(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.pdfsService.findChapter(chapterId, req.user);
  }

  @ApiOperation({ summary: 'Update a chapter folder (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('chapters/:chapterId')
  async updateChapter(@Param('chapterId') chapterId: string, @Body() dto: UpdateLibraryFolderDto) {
    return this.pdfsService.updateChapter(chapterId, dto);
  }

  @ApiOperation({ summary: 'Delete a chapter folder and its PDFs (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('chapters/:chapterId')
  async removeChapter(@Param('chapterId') chapterId: string) {
    return this.pdfsService.removeChapter(chapterId);
  }

  // --- Documents ---

  @ApiOperation({ summary: 'List PDFs inside a chapter folder' })
  @Get('chapters/:chapterId/documents')
  async listDocuments(@Request() req: any, @Param('chapterId') chapterId: string) {
    return this.pdfsService.listDocuments(chapterId, req.user);
  }

  @ApiOperation({ summary: 'Add a PDF entry to a chapter (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Post('chapters/:chapterId/documents')
  async createDocument(@Param('chapterId') chapterId: string, @Body() dto: CreatePdfDocumentDto) {
    return this.pdfsService.createDocument(chapterId, dto);
  }

  @ApiOperation({ summary: 'Reorder PDFs within a chapter (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('chapters/:chapterId/documents/reorder')
  async reorderDocuments(@Param('chapterId') chapterId: string, @Body() dto: ReorderDto) {
    return this.pdfsService.reorderDocuments(chapterId, dto);
  }

  @ApiOperation({ summary: 'Get a single PDF entry' })
  @Get('documents/:documentId')
  async getDocument(@Request() req: any, @Param('documentId') documentId: string) {
    return this.pdfsService.findDocument(documentId, req.user);
  }

  @ApiOperation({ summary: 'Update a PDF entry (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Patch('documents/:documentId')
  async updateDocument(@Param('documentId') documentId: string, @Body() dto: UpdatePdfDocumentDto) {
    return this.pdfsService.updateDocument(documentId, dto);
  }

  @ApiOperation({ summary: 'Delete a PDF entry (Admin / Staff with manage_pdfs)' })
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @Delete('documents/:documentId')
  async removeDocument(@Param('documentId') documentId: string) {
    return this.pdfsService.removeDocument(documentId);
  }

  @ApiOperation({ summary: 'Upload/replace the file for a PDF entry (Admin / Staff with manage_pdfs)' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(...MANAGE_PDFS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('managePdfs')
  @UseInterceptors(FileInterceptor('file', { limits: PDF_UPLOAD_LIMITS }))
  @Post('documents/:documentId/file')
  async uploadDocumentFile(@Param('documentId') documentId: string, @UploadedFile() file: Express.Multer.File) {
    return this.pdfsService.uploadDocumentFile(documentId, file);
  }
}

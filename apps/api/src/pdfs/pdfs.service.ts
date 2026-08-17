import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessActor } from '../common/access/quiz-access.service';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreatePdfDocumentDto, UpdatePdfDocumentDto } from './dto/pdf-document.dto';

/** Supabase Storage bucket holding every document in this library. */
const PDF_BUCKET = 'library-pdfs';

/** See the matching note in videos.service.ts — write paths must see hidden rows. */
const CURATOR: AccessActor = { id: '', role: UserRole.ADMIN };

/**
 * The PDF library: Exam → Chapter → PDF.
 *
 * Structurally a twin of the video library, and deliberately its own module —
 * the two have separate tables, permissions, and exam folders, so curating one
 * never disturbs the other.
 */
@Injectable()
export class PdfsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  private static isCurator(actor?: AccessActor | null): boolean {
    return actor?.role === UserRole.ADMIN || actor?.role === UserRole.STAFF;
  }

  private activeFilter(actor?: AccessActor | null) {
    return PdfsService.isCurator(actor) ? {} : { isActive: true };
  }

  // --- Exams ---

  async listExams(actor?: AccessActor | null) {
    const exams = await this.prisma.pdfExam.findMany({
      where: this.activeFilter(actor),
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        chapters: {
          where: this.activeFilter(actor),
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            orderIndex: true,
            isActive: true,
            examId: true,
            _count: { select: { documents: true } },
          },
        },
      },
    });

    return exams.map(({ chapters, ...exam }) => ({
      ...exam,
      chapterCount: chapters.length,
      documentCount: chapters.reduce((total, chapter) => total + chapter._count.documents, 0),
      chapters: chapters.map((c) => ({
        id: c.id,
        examId: c.examId,
        title: c.title,
        description: c.description,
        orderIndex: c.orderIndex,
        isActive: c.isActive,
        documentCount: c._count.documents,
      })),
    }));
  }

  async findExam(examId: string, actor?: AccessActor | null) {
    const exam = await this.prisma.pdfExam.findUnique({ where: { id: examId } });
    if (!exam || (!exam.isActive && !PdfsService.isCurator(actor))) {
      throw new NotFoundException('Exam folder not found');
    }
    return exam;
  }

  async createExam(dto: CreateLibraryFolderDto) {
    return this.prisma.pdfExam.create({ data: dto });
  }

  async updateExam(examId: string, dto: UpdateLibraryFolderDto) {
    await this.findExam(examId, CURATOR);
    return this.prisma.pdfExam.update({ where: { id: examId }, data: dto });
  }

  async removeExam(examId: string) {
    await this.findExam(examId, CURATOR);
    return this.prisma.pdfExam.delete({ where: { id: examId } });
  }

  async reorderExams(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pdfExam.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listExams(CURATOR);
  }

  // --- Chapters ---

  async listChapters(examId: string, actor?: AccessActor | null) {
    await this.findExam(examId, actor);
    const chapters = await this.prisma.pdfChapter.findMany({
      where: { examId, ...this.activeFilter(actor) },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { documents: true } },
        documents: {
          where: this.activeFilter(actor),
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            fileUrl: true,
            fileName: true,
            fileSizeBytes: true,
            orderIndex: true,
            isActive: true,
          },
        },
      },
    });
    return chapters.map(({ _count, documents, ...chapter }) => ({
      ...chapter,
      documentCount: _count.documents,
      documents,
    }));
  }

  async findChapter(chapterId: string, actor?: AccessActor | null) {
    const chapter = await this.prisma.pdfChapter.findUnique({
      where: { id: chapterId },
      include: { exam: true },
    });
    if (!chapter) throw new NotFoundException('Chapter folder not found');
    if (!PdfsService.isCurator(actor) && (!chapter.isActive || !chapter.exam.isActive)) {
      throw new NotFoundException('Chapter folder not found');
    }
    return chapter;
  }

  async createChapter(examId: string, dto: CreateLibraryFolderDto) {
    await this.findExam(examId, CURATOR);
    return this.prisma.pdfChapter.create({ data: { ...dto, examId } });
  }

  async updateChapter(chapterId: string, dto: UpdateLibraryFolderDto) {
    await this.findChapter(chapterId, CURATOR);
    return this.prisma.pdfChapter.update({ where: { id: chapterId }, data: dto });
  }

  async removeChapter(chapterId: string) {
    await this.findChapter(chapterId, CURATOR);
    return this.prisma.pdfChapter.delete({ where: { id: chapterId } });
  }

  async reorderChapters(examId: string, dto: ReorderDto) {
    await this.findExam(examId, CURATOR);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pdfChapter.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listChapters(examId, CURATOR);
  }

  // --- Documents ---

  async listDocuments(chapterId: string, actor?: AccessActor | null) {
    await this.findChapter(chapterId, actor);
    const documents = await this.prisma.pdfDocument.findMany({
      where: { chapterId, ...this.activeFilter(actor) },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
    // A row whose upload never completed has nothing for a student to open, so
    // it stays in the admin's list (to finish or delete) but not in theirs.
    return PdfsService.isCurator(actor) ? documents : documents.filter((doc) => doc.fileUrl);
  }

  async findDocument(documentId: string, actor?: AccessActor | null) {
    const document = await this.prisma.pdfDocument.findUnique({
      where: { id: documentId },
      include: { chapter: { include: { exam: true } } },
    });
    if (!document) throw new NotFoundException('PDF not found');
    if (
      !PdfsService.isCurator(actor) &&
      (!document.isActive || !document.chapter.isActive || !document.chapter.exam.isActive)
    ) {
      throw new NotFoundException('PDF not found');
    }
    return document;
  }

  async createDocument(chapterId: string, dto: CreatePdfDocumentDto) {
    await this.findChapter(chapterId, CURATOR);
    return this.prisma.pdfDocument.create({ data: { ...dto, chapterId } });
  }

  async updateDocument(documentId: string, dto: UpdatePdfDocumentDto) {
    await this.findDocument(documentId, CURATOR);
    return this.prisma.pdfDocument.update({ where: { id: documentId }, data: dto });
  }

  async removeDocument(documentId: string) {
    await this.findDocument(documentId, CURATOR);
    return this.prisma.pdfDocument.delete({ where: { id: documentId } });
  }

  async reorderDocuments(chapterId: string, dto: ReorderDto) {
    await this.findChapter(chapterId, CURATOR);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pdfDocument.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listDocuments(chapterId, CURATOR);
  }

  async uploadDocumentFile(documentId: string, file: Express.Multer.File) {
    const document = await this.findDocument(documentId, CURATOR);
    if (!file) throw new BadRequestException('No file was uploaded');
    // Multer hands over whatever the browser claimed. Anything that is not a
    // PDF would end up served from a public bucket under a .pdf-shaped link,
    // so it is refused here rather than stored and discovered later.
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files can be uploaded to the PDF library');
    }

    const url = await this.storageService.upload(
      PDF_BUCKET,
      `${document.chapterId}/${documentId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    return this.prisma.pdfDocument.update({
      where: { id: documentId },
      data: { fileUrl: url, fileName: file.originalname, fileSizeBytes: file.size },
    });
  }
}

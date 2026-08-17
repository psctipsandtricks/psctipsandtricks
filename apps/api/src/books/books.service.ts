import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BookAccessService } from '../common/access/book-access.service';
import { AccessActor } from '../common/access/quiz-access.service';
import { AudioProcessingService } from '../audio-processing/audio-processing.service';
import { AudioEntityType } from '../audio-processing/audio-processing.types';
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

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private bookAccess: BookAccessService,
    private audioProcessingService: AudioProcessingService,
  ) {}

  async findAll(
    options?:
      | AccessActor
      | null
      | {
          page?: number;
          limit?: number;
          search?: string;
          category?: string;
          subscriptionType?: string;
        },
    actor?: AccessActor | null,
  ) {
    const isOptionsObj =
      options &&
      typeof options === 'object' &&
      ('page' in options || 'limit' in options || 'search' in options || 'category' in options || 'subscriptionType' in options);
    const query = isOptionsObj ? (options as any) : undefined;
    const effectiveActor = isOptionsObj ? actor : (options as AccessActor | null);

    const where: any = { isLegacyPlaceholder: false };

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (query?.subscriptionType && query.subscriptionType !== 'ALL') {
      where.subscriptionType = query.subscriptionType;
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query?.page || query?.limit) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
      const skip = (page - 1) * limit;

      const [total, books] = await Promise.all([
        this.prisma.book.count({ where }),
        this.prisma.book.findMany({
          where,
          include: {
            _count: {
              select: {
                orders: { where: { status: 'SUCCESS' } },
                chapters: true,
              },
            },
            chapters: {
              select: {
                _count: {
                  select: { topics: true },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const redacted = await this.bookAccess.redactBookList(effectiveActor, books);
      const withCounts = redacted.map((b: any) => ({
        ...b,
        ordersCount: b._count?.orders ?? 0,
        chaptersCount: b._count?.chapters ?? 0,
        topicsCount: b.chapters?.reduce((sum: number, ch: any) => sum + (ch._count?.topics || 0), 0) ?? 0,
      }));

      return {
        data: withCounts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const books = await this.prisma.book.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: { where: { status: 'SUCCESS' } },
            chapters: true,
          },
        },
        chapters: {
          select: {
            _count: {
              select: { topics: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const redacted = await this.bookAccess.redactBookList(effectiveActor, books);
    return redacted.map((b: any) => ({
      ...b,
      ordersCount: b._count?.orders ?? 0,
      chaptersCount: b._count?.chapters ?? 0,
      topicsCount: b.chapters?.reduce((sum: number, ch: any) => sum + (ch._count?.topics || 0), 0) ?? 0,
    }));
  }

  async findOne(id: string, actor?: AccessActor | null) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!book) throw new NotFoundException('Book not found');

    // The PDF is the whole purchasable asset, so it's described but not
    // handed over until the caller has paid for it.
    const access = await this.bookAccess.getAccessState(actor, book);
    return { ...this.bookAccess.stripPdfIfLocked(book, access), access };
  }

  /** Full reader tree (chapters → topics → subtopics) for the continuous reader — gated the same way as a download, since it hands over every topic's PDF/audio URL. */
  async getReaderContent(id: string, actor: AccessActor | null | undefined) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');

    const access = await this.bookAccess.getAccessState(actor, book);
    if (!access.hasAccess) {
      throw new ForbiddenException(
        access.reason === 'LOGIN_REQUIRED'
          ? 'Log in to read this premium book.'
          : 'This is a premium book. Complete the payment to unlock the reader.',
      );
    }

    const chapters = await this.prisma.chapter.findMany({
      where: { bookId: id, isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        topics: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
          include: {
            subtopics: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    return {
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        category: book.category,
      },
      chapters: chapters.map((chapter) => ({
        ...BooksService.stripAdminAudioFields(chapter),
        topics: chapter.topics.map((topic) => ({
          ...BooksService.stripAdminAudioFields(topic),
          subtopics: topic.subtopics.map((subtopic) => BooksService.stripAdminAudioFields(subtopic)),
        })),
      })),
    };
  }

  /** originalAudioUrl/audioSyncError are for the admin panel only — the reader only needs status + segments. */
  private static stripAdminAudioFields<T extends { originalAudioUrl?: unknown; audioSyncError?: unknown }>(
    entity: T,
  ): Omit<T, 'originalAudioUrl' | 'audioSyncError'> {
    const { originalAudioUrl, audioSyncError, ...rest } = entity;
    return rest;
  }

  /** Gates the actual PDF handover and counts it — this is the only place downloadCount moves. */
  async recordDownload(id: string, actor: AccessActor | null | undefined) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');

    await this.bookAccess.assertCanDownload(actor, book);
    const updated = await this.prisma.book.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
    return { url: book.pdfUrl, downloadCount: updated.downloadCount };
  }

  /**
   * `finalPrice` is what the checkout actually charges, so it is always
   * derived here rather than accepted from the client — a caller cannot send
   * a discounted total that the price/discount pair doesn't justify.
   */
  private static resolveFinalPrice(price: number, discountPercent: number) {
    const safePrice = Math.max(0, price);
    const safeDiscount = Math.min(100, Math.max(0, discountPercent));
    return Math.round(safePrice - (safePrice * safeDiscount) / 100);
  }

  async create(data: CreateBookDto) {
    const price = data.price ?? 0;
    const discountPercent = data.discountPercent ?? 0;
    return this.prisma.book.create({
      data: { ...data, price, discountPercent, finalPrice: BooksService.resolveFinalPrice(price, discountPercent) },
    });
  }

  async update(id: string, data: UpdateBookDto) {
    const existing = await this.findOne(id);
    const price = data.price ?? existing.price;
    const discountPercent = data.discountPercent ?? existing.discountPercent;
    return this.prisma.book.update({
      where: { id },
      data: { ...data, finalPrice: BooksService.resolveFinalPrice(price, discountPercent) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.book.delete({ where: { id } });
  }

  async uploadCover(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    const url = await this.storageService.upload(
      'book-covers',
      `${id}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.book.update({ where: { id }, data: { coverUrl: url } });
  }

  // --- Chapters ---

  async listChapters(bookId: string) {
    const chapters = await this.prisma.chapter.findMany({
      where: { bookId },
      include: {
        topics: {
          select: {
            id: true,
            title: true,
            description: true,
            orderIndex: true,
            isActive: true,
            youtubeUrl: true,
            audioUrl: true,
            pdfUrl: true,
            _count: { select: { subtopics: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { topics: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return chapters.map((c) => ({
      ...c,
      topicsCount: c._count?.topics ?? 0,
      topics: c.topics.map((t) => ({
        ...t,
        subtopicsCount: t._count?.subtopics ?? 0,
      })),
    }));
  }

  async addChapter(bookId: string, dto: CreateChapterDto) {
    await this.findOne(bookId);
    return this.prisma.chapter.create({
      data: { ...dto, bookId },
    });
  }

  async reorderChapters(bookId: string, dto: ReorderChaptersDto) {
    await this.findOne(bookId);
    await this.prisma.$transaction(
      dto.chapters.map((c) =>
        this.prisma.chapter.update({
          where: { id: c.id },
          data: { orderIndex: c.orderIndex },
        }),
      ),
    );
    return this.listChapters(bookId);
  }

  async findChapter(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  async updateChapter(chapterId: string, dto: UpdateChapterDto) {
    await this.findChapter(chapterId);
    return this.prisma.chapter.update({ where: { id: chapterId }, data: dto });
  }

  async removeChapter(chapterId: string) {
    await this.findChapter(chapterId);
    return this.prisma.chapter.delete({ where: { id: chapterId } });
  }

  async uploadChapterAudio(chapterId: string, file: Express.Multer.File) {
    const chapter = await this.findChapter(chapterId);
    const url = await this.storageService.upload(
      'chapter-audio',
      `${chapter.bookId}/${chapterId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { audioUrl: url, originalAudioUrl: url },
    });
    await this.audioProcessingService.enqueue('chapter', chapterId);
    return updated;
  }

  async uploadChapterPdf(chapterId: string, file: Express.Multer.File) {
    const chapter = await this.findChapter(chapterId);
    const url = await this.storageService.upload(
      'chapter-pdfs',
      `${chapter.bookId}/${chapterId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { pdfUrl: url },
    });
    // Audio might already exist — the PDF can arrive before or after it via
    // the admin's two separate upload requests, so (re)trigger sync either way.
    if (chapter.audioUrl) await this.audioProcessingService.enqueue('chapter', chapterId);
    return updated;
  }

  async reprocessChapterAudio(chapterId: string) {
    const chapter = await this.findChapter(chapterId);
    if (!chapter.originalAudioUrl) throw new BadRequestException('No original audio to reprocess for this chapter');
    await this.audioProcessingService.enqueue('chapter', chapterId);
    return this.findChapter(chapterId);
  }

  // --- Topics ---

  async listTopics(chapterId: string) {
    await this.findChapter(chapterId);
    const topics = await this.prisma.topic.findMany({
      where: { chapterId },
      include: {
        _count: { select: { subtopics: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
    return topics.map((t) => ({
      ...t,
      subtopicsCount: t._count?.subtopics ?? 0,
    }));
  }

  async addTopic(chapterId: string, dto: CreateTopicDto) {
    await this.findChapter(chapterId);
    return this.prisma.topic.create({
      data: { ...dto, chapterId },
    });
  }

  async reorderTopics(chapterId: string, dto: ReorderTopicsDto) {
    await this.findChapter(chapterId);
    await this.prisma.$transaction(
      dto.topics.map((t) =>
        this.prisma.topic.update({
          where: { id: t.id },
          data: { orderIndex: t.orderIndex },
        }),
      ),
    );
    return this.listTopics(chapterId);
  }

  async findTopic(topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async updateTopic(topicId: string, dto: UpdateTopicDto) {
    await this.findTopic(topicId);
    return this.prisma.topic.update({ where: { id: topicId }, data: dto });
  }

  async removeTopic(topicId: string) {
    await this.findTopic(topicId);
    return this.prisma.topic.delete({ where: { id: topicId } });
  }

  async uploadTopicAudio(topicId: string, file: Express.Multer.File) {
    await this.findTopic(topicId);
    const url = await this.storageService.upload(
      'topic-audio',
      `${topicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.topic.update({
      where: { id: topicId },
      data: { audioUrl: url, originalAudioUrl: url },
    });
    await this.audioProcessingService.enqueue('topic', topicId);
    return updated;
  }

  async uploadTopicPdf(topicId: string, file: Express.Multer.File) {
    const topic = await this.findTopic(topicId);
    const url = await this.storageService.upload(
      'topic-pdfs',
      `${topicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.topic.update({ where: { id: topicId }, data: { pdfUrl: url } });
    if (topic.audioUrl) await this.audioProcessingService.enqueue('topic', topicId);
    return updated;
  }

  async reprocessTopicAudio(topicId: string) {
    const topic = await this.findTopic(topicId);
    if (!topic.originalAudioUrl) throw new BadRequestException('No original audio to reprocess for this topic');
    await this.audioProcessingService.enqueue('topic', topicId);
    return this.findTopic(topicId);
  }

  // --- Subtopics ---

  async listSubtopics(topicId: string) {
    await this.findTopic(topicId);
    return this.prisma.subtopic.findMany({
      where: { topicId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async addSubtopic(topicId: string, dto: CreateSubtopicDto) {
    await this.findTopic(topicId);
    return this.prisma.subtopic.create({
      data: { ...dto, topicId },
    });
  }

  async reorderSubtopics(topicId: string, dto: ReorderSubtopicsDto) {
    await this.findTopic(topicId);
    await this.prisma.$transaction(
      dto.subtopics.map((s) =>
        this.prisma.subtopic.update({
          where: { id: s.id },
          data: { orderIndex: s.orderIndex },
        }),
      ),
    );
    return this.listSubtopics(topicId);
  }

  async findSubtopic(subtopicId: string) {
    const subtopic = await this.prisma.subtopic.findUnique({ where: { id: subtopicId } });
    if (!subtopic) throw new NotFoundException('Subtopic not found');
    return subtopic;
  }

  async updateSubtopic(subtopicId: string, dto: UpdateSubtopicDto) {
    await this.findSubtopic(subtopicId);
    return this.prisma.subtopic.update({ where: { id: subtopicId }, data: dto });
  }

  async removeSubtopic(subtopicId: string) {
    await this.findSubtopic(subtopicId);
    return this.prisma.subtopic.delete({ where: { id: subtopicId } });
  }

  async uploadSubtopicAudio(subtopicId: string, file: Express.Multer.File) {
    await this.findSubtopic(subtopicId);
    const url = await this.storageService.upload(
      'subtopic-audio',
      `${subtopicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.subtopic.update({
      where: { id: subtopicId },
      data: { audioUrl: url, originalAudioUrl: url },
    });
    await this.audioProcessingService.enqueue('subtopic', subtopicId);
    return updated;
  }

  async uploadSubtopicPdf(subtopicId: string, file: Express.Multer.File) {
    const subtopic = await this.findSubtopic(subtopicId);
    const url = await this.storageService.upload(
      'subtopic-pdfs',
      `${subtopicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.subtopic.update({ where: { id: subtopicId }, data: { pdfUrl: url } });
    if (subtopic.audioUrl) await this.audioProcessingService.enqueue('subtopic', subtopicId);
    return updated;
  }

  async reprocessSubtopicAudio(subtopicId: string) {
    const subtopic = await this.findSubtopic(subtopicId);
    if (!subtopic.originalAudioUrl) throw new BadRequestException('No original audio to reprocess for this subtopic');
    await this.audioProcessingService.enqueue('subtopic', subtopicId);
    return this.findSubtopic(subtopicId);
  }

  /** One-time/backfill bulk trigger: (re)process every unit that has audio but no successful sync yet. */
  async reprocessAllAudio() {
    const pendingStatuses = ['NONE', 'FAILED'] as const;

    const [chapters, topics, subtopics] = await Promise.all([
      this.prisma.chapter.findMany({
        where: { audioUrl: { not: null }, audioSyncStatus: { in: [...pendingStatuses] } },
        select: { id: true },
      }),
      this.prisma.topic.findMany({
        where: { audioUrl: { not: null }, audioSyncStatus: { in: [...pendingStatuses] } },
        select: { id: true },
      }),
      this.prisma.subtopic.findMany({
        where: { audioUrl: { not: null }, audioSyncStatus: { in: [...pendingStatuses] } },
        select: { id: true },
      }),
    ]);

    const jobs: { entityType: AudioEntityType; entityId: string }[] = [
      ...chapters.map((c) => ({ entityType: 'chapter' as const, entityId: c.id })),
      ...topics.map((t) => ({ entityType: 'topic' as const, entityId: t.id })),
      ...subtopics.map((s) => ({ entityType: 'subtopic' as const, entityId: s.id })),
    ];

    for (const job of jobs) {
      // Pre-existing rows (uploaded before this feature) have no
      // originalAudioUrl yet — backfill it from audioUrl so the pipeline has
      // a source file to denoise from.
      await this.backfillOriginalAudioUrl(job.entityType, job.entityId);
      await this.audioProcessingService.enqueue(job.entityType, job.entityId);
    }

    return { enqueued: jobs.length };
  }

  private async backfillOriginalAudioUrl(entityType: AudioEntityType, entityId: string) {
    switch (entityType) {
      case 'chapter': {
        const chapter = await this.prisma.chapter.findUniqueOrThrow({ where: { id: entityId } });
        if (!chapter.originalAudioUrl && chapter.audioUrl) {
          await this.prisma.chapter.update({ where: { id: entityId }, data: { originalAudioUrl: chapter.audioUrl } });
        }
        return;
      }
      case 'topic': {
        const topic = await this.prisma.topic.findUniqueOrThrow({ where: { id: entityId } });
        if (!topic.originalAudioUrl && topic.audioUrl) {
          await this.prisma.topic.update({ where: { id: entityId }, data: { originalAudioUrl: topic.audioUrl } });
        }
        return;
      }
      case 'subtopic': {
        const subtopic = await this.prisma.subtopic.findUniqueOrThrow({ where: { id: entityId } });
        if (!subtopic.originalAudioUrl && subtopic.audioUrl) {
          await this.prisma.subtopic.update({
            where: { id: entityId },
            data: { originalAudioUrl: subtopic.audioUrl },
          });
        }
        return;
      }
    }
  }
}

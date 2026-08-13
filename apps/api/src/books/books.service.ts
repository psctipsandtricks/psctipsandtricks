import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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
  ) {}

  async findAll() {
    return this.prisma.book.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
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
    return this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { orderIndex: 'asc' },
    });
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
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { audioUrl: url },
    });
  }

  async uploadChapterPdf(chapterId: string, file: Express.Multer.File) {
    const chapter = await this.findChapter(chapterId);
    const url = await this.storageService.upload(
      'chapter-pdfs',
      `${chapter.bookId}/${chapterId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { pdfUrl: url },
    });
  }

  // --- Topics ---

  async listTopics(chapterId: string) {
    await this.findChapter(chapterId);
    return this.prisma.topic.findMany({
      where: { chapterId },
      orderBy: { orderIndex: 'asc' },
    });
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
    return this.prisma.topic.update({ where: { id: topicId }, data: { audioUrl: url } });
  }

  async uploadTopicPdf(topicId: string, file: Express.Multer.File) {
    await this.findTopic(topicId);
    const url = await this.storageService.upload(
      'topic-pdfs',
      `${topicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.topic.update({ where: { id: topicId }, data: { pdfUrl: url } });
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
    return this.prisma.subtopic.update({ where: { id: subtopicId }, data: { audioUrl: url } });
  }

  async uploadSubtopicPdf(subtopicId: string, file: Express.Multer.File) {
    await this.findSubtopic(subtopicId);
    const url = await this.storageService.upload(
      'subtopic-pdfs',
      `${subtopicId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.subtopic.update({ where: { id: subtopicId }, data: { pdfUrl: url } });
  }
}

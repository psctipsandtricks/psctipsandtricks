import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';

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

  async create(data: CreateBookDto) {
    return this.prisma.book.create({ data });
  }

  async update(id: string, data: UpdateBookDto) {
    await this.findOne(id);
    return this.prisma.book.update({ where: { id }, data });
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

  private async findChapter(chapterId: string) {
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
}

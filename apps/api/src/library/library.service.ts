import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertProgressDto } from './dto/upsert-progress.dto';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  async getProgress(userId: string, bookId?: string) {
    return this.prisma.readingProgress.findMany({
      where: { userId, ...(bookId ? { bookId } : {}) },
      orderBy: { lastReadAt: 'desc' },
    });
  }

  async upsertProgress(userId: string, dto: UpsertProgressDto) {
    return this.prisma.readingProgress.upsert({
      where: { userId_bookId: { userId, bookId: dto.bookId } },
      create: {
        userId,
        bookId: dto.bookId,
        chapterId: dto.chapterId,
        topicId: dto.topicId,
        progressPercent: dto.progressPercent,
      },
      update: {
        chapterId: dto.chapterId,
        topicId: dto.topicId,
        progressPercent: dto.progressPercent,
        lastReadAt: new Date(),
      },
    });
  }

  async getBookmarks(userId: string) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addBookmark(userId: string, dto: CreateBookmarkDto) {
    return this.prisma.bookmark.upsert({
      where: {
        userId_referenceType_referenceId: {
          userId,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
        },
      },
      create: { userId, referenceType: dto.referenceType, referenceId: dto.referenceId },
      update: {},
    });
  }

  async removeBookmark(userId: string, id: string) {
    return this.prisma.bookmark.deleteMany({ where: { id, userId } });
  }
}

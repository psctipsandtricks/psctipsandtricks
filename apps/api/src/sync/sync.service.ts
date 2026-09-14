import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

export interface ContentRevisions {
  books: string;
  quizzes: string;
  mockTests: string;
  videos: string;
  pdfs: string;
  announcements: string;
}

export interface SyncStatusResponse {
  revisions: ContentRevisions;
  serverTime: number;
}

export interface SyncEvent {
  domain: 'mockTests' | 'quizzes' | 'books' | 'videos' | 'pdfs' | 'announcements';
  action: 'create' | 'update' | 'delete' | 'statusChange';
  timestamp: number;
  data?: any;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  private cachedResponse: SyncStatusResponse | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 4000; // 4 seconds in-memory cache
  private readonly events$ = new Subject<SyncEvent>();

  /** Immediately clears cache so subsequent sync status checks return fresh data. */
  invalidateCache() {
    this.cachedResponse = null;
    this.cacheExpiresAt = 0;
  }

  /** Emits a real-time event to all connected listeners and invalidates cache. */
  emitEvent(event: SyncEvent) {
    this.invalidateCache();
    this.events$.next(event);
  }

  /** Returns an Observable suitable for NestJS SSE endpoints. */
  getEventsObservable(): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      map((event) => ({
        data: event,
      } as MessageEvent)),
    );
  }

  /**
   * Returns a map of current content revision hashes across all main modules.
   * Cached for 4 seconds so that concurrent polling from many mobile devices
   * places negligible load on the database.
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    const now = Date.now();
    if (this.cachedResponse && now < this.cacheExpiresAt) {
      return this.cachedResponse;
    }

    const [
      latestBook,
      bookCount,
      latestQuiz,
      quizCount,
      latestQuizFolder,
      quizFolderCount,
      latestMockTest,
      mockTestCount,
      latestVideo,
      videoCount,
      latestVideoFolder,
      videoFolderCount,
      latestPdf,
      pdfCount,
      latestPdfFolder,
      pdfFolderCount,
      latestAnnouncement,
      announcementCount,
    ] = await Promise.all([
      // Books
      this.prisma.book.findFirst({
        where: { isPublished: true, isLegacyPlaceholder: false },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.book.count({
        where: { isPublished: true, isLegacyPlaceholder: false },
      }),

      // Quizzes
      this.prisma.quiz.findFirst({
        where: { isActive: true },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.quiz.count({
        where: { isActive: true },
      }),
      this.prisma.quizFolder.findFirst({
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.quizFolder.count(),

      // Mock Tests
      this.prisma.mockTest.findFirst({
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.mockTest.count(),

      // Videos
      this.prisma.video.findFirst({
        where: { isActive: true },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.video.count({
        where: { isActive: true },
      }),
      this.prisma.videoFolder.findFirst({
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.videoFolder.count(),

      // PDFs
      this.prisma.pdfDocument.findFirst({
        where: { isActive: true },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.pdfDocument.count({
        where: { isActive: true },
      }),
      this.prisma.pdfFolder.findFirst({
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.pdfFolder.count(),

      // Announcements
      this.prisma.announcementPopup.findFirst({
        where: { isActive: true },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.announcementPopup.count({
        where: { isActive: true },
      }),
    ]);

    // Combine item and folder timestamps
    const maxQuizTime = Math.max(
      latestQuiz?.updatedAt?.getTime() ?? 0,
      latestQuizFolder?.updatedAt?.getTime() ?? 0,
    );
    const totalQuizItems = quizCount + quizFolderCount;

    const maxVideoTime = Math.max(
      latestVideo?.updatedAt?.getTime() ?? 0,
      latestVideoFolder?.updatedAt?.getTime() ?? 0,
    );
    const totalVideoItems = videoCount + videoFolderCount;

    const maxPdfTime = Math.max(
      latestPdf?.updatedAt?.getTime() ?? 0,
      latestPdfFolder?.updatedAt?.getTime() ?? 0,
    );
    const totalPdfItems = pdfCount + pdfFolderCount;

    const revisions: ContentRevisions = {
      books: `${latestBook?.updatedAt?.getTime() ?? 0}:${bookCount}`,
      quizzes: `${maxQuizTime}:${totalQuizItems}`,
      mockTests: `${latestMockTest?.updatedAt?.getTime() ?? 0}:${mockTestCount}`,
      videos: `${maxVideoTime}:${totalVideoItems}`,
      pdfs: `${maxPdfTime}:${totalPdfItems}`,
      announcements: `${latestAnnouncement?.updatedAt?.getTime() ?? 0}:${announcementCount}`,
    };

    const response: SyncStatusResponse = {
      revisions,
      serverTime: now,
    };

    this.cachedResponse = response;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;

    return response;
  }
}

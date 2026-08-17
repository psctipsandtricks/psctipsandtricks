import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessActor } from '../common/access/quiz-access.service';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { parseYoutubeLink } from './youtube';

/**
 * Write paths reuse the same lookups as reads, but must resolve rows the
 * student-facing filter hides — an admin has to be able to edit and delete the
 * content they just switched off. The controller has already established the
 * caller is an admin or permitted staff member by the time any of these run,
 * so this stands in for "visibility is not the question here".
 */
const CURATOR: AccessActor = { id: '', role: UserRole.ADMIN };

/**
 * The YouTube video library: Exam → Chapter → Video.
 *
 * Every read is authenticated but free — there is no paywall here, unlike the
 * book catalogue. The one distinction is staff visibility: an admin browsing
 * the same endpoints sees rows they have switched off, so they can find and
 * re-enable them, while students only ever see active content.
 */
@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}

  /** Admins and staff see unpublished rows; everyone else is limited to active ones. */
  private static isCurator(actor?: AccessActor | null): boolean {
    return actor?.role === UserRole.ADMIN || actor?.role === UserRole.STAFF;
  }

  private activeFilter(actor?: AccessActor | null) {
    return VideosService.isCurator(actor) ? {} : { isActive: true };
  }

  // --- Exams ---

  async listExams(actor?: AccessActor | null) {
    const exams = await this.prisma.videoExam.findMany({
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
            _count: { select: { videos: true } },
          },
        },
      },
    });

    return exams.map(({ chapters, ...exam }) => ({
      ...exam,
      chapterCount: chapters.length,
      videoCount: chapters.reduce((total, chapter) => total + chapter._count.videos, 0),
      chapters: chapters.map((c) => ({
        id: c.id,
        examId: c.examId,
        title: c.title,
        description: c.description,
        orderIndex: c.orderIndex,
        isActive: c.isActive,
        videoCount: c._count.videos,
      })),
    }));
  }

  async findExam(examId: string, actor?: AccessActor | null) {
    const exam = await this.prisma.videoExam.findUnique({ where: { id: examId } });
    if (!exam || (!exam.isActive && !VideosService.isCurator(actor))) {
      throw new NotFoundException('Exam folder not found');
    }
    return exam;
  }

  async createExam(dto: CreateLibraryFolderDto) {
    return this.prisma.videoExam.create({ data: dto });
  }

  async updateExam(examId: string, dto: UpdateLibraryFolderDto) {
    await this.findExam(examId, CURATOR);
    return this.prisma.videoExam.update({ where: { id: examId }, data: dto });
  }

  async removeExam(examId: string) {
    await this.findExam(examId, CURATOR);
    return this.prisma.videoExam.delete({ where: { id: examId } });
  }

  async reorderExams(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.videoExam.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listExams(CURATOR);
  }

  // --- Chapters ---

  async listChapters(examId: string, actor?: AccessActor | null) {
    await this.findExam(examId, actor);
    const chapters = await this.prisma.videoChapter.findMany({
      where: { examId, ...this.activeFilter(actor) },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { videos: true } },
        videos: {
          where: this.activeFilter(actor),
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            youtubeUrl: true,
            orderIndex: true,
            isActive: true,
          },
        },
      },
    });
    return chapters.map(({ _count, videos, ...chapter }) => ({
      ...chapter,
      videoCount: _count.videos,
      videos,
    }));
  }

  async findChapter(chapterId: string, actor?: AccessActor | null) {
    const chapter = await this.prisma.videoChapter.findUnique({
      where: { id: chapterId },
      include: { exam: true },
    });
    if (!chapter) throw new NotFoundException('Chapter folder not found');
    // A chapter inside a switched-off exam is unreachable too, otherwise
    // hiding an exam would leave its chapters addressable by direct link.
    if (!VideosService.isCurator(actor) && (!chapter.isActive || !chapter.exam.isActive)) {
      throw new NotFoundException('Chapter folder not found');
    }
    return chapter;
  }

  async createChapter(examId: string, dto: CreateLibraryFolderDto) {
    await this.findExam(examId, CURATOR);
    return this.prisma.videoChapter.create({ data: { ...dto, examId } });
  }

  async updateChapter(chapterId: string, dto: UpdateLibraryFolderDto) {
    await this.findChapter(chapterId, CURATOR);
    return this.prisma.videoChapter.update({ where: { id: chapterId }, data: dto });
  }

  async removeChapter(chapterId: string) {
    await this.findChapter(chapterId, CURATOR);
    return this.prisma.videoChapter.delete({ where: { id: chapterId } });
  }

  async reorderChapters(examId: string, dto: ReorderDto) {
    await this.findExam(examId, CURATOR);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.videoChapter.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listChapters(examId, CURATOR);
  }

  // --- Videos ---

  async listVideos(chapterId: string, actor?: AccessActor | null) {
    await this.findChapter(chapterId, actor);
    return this.prisma.video.findMany({
      where: { chapterId, ...this.activeFilter(actor) },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findVideo(videoId: string, actor?: AccessActor | null) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { chapter: { include: { exam: true } } },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (
      !VideosService.isCurator(actor) &&
      (!video.isActive || !video.chapter.isActive || !video.chapter.exam.isActive)
    ) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async createVideo(chapterId: string, dto: CreateVideoDto) {
    await this.findChapter(chapterId, CURATOR);
    const { youtubeUrl, ...rest } = dto;
    return this.prisma.video.create({
      data: { ...rest, chapterId, ...parseYoutubeLink(youtubeUrl) },
    });
  }

  async updateVideo(videoId: string, dto: UpdateVideoDto) {
    await this.findVideo(videoId, CURATOR);
    const { youtubeUrl, ...rest } = dto;
    return this.prisma.video.update({
      where: { id: videoId },
      // Re-parsing on every link change keeps id/thumbnail in step with the
      // URL; leaving the link alone leaves all three untouched.
      data: { ...rest, ...(youtubeUrl ? parseYoutubeLink(youtubeUrl) : {}) },
    });
  }

  async removeVideo(videoId: string) {
    await this.findVideo(videoId, CURATOR);
    return this.prisma.video.delete({ where: { id: videoId } });
  }

  async reorderVideos(chapterId: string, dto: ReorderDto) {
    await this.findChapter(chapterId, CURATOR);
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.video.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return this.listVideos(chapterId, CURATOR);
  }
}

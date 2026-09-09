import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessActor } from '../common/access/quiz-access.service';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { parseYoutubeLink } from './youtube';

const CURATOR: AccessActor = { id: '', role: UserRole.ADMIN };

@Injectable()
export class VideosService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  private static isCurator(actor?: AccessActor | null): boolean {
    return actor?.role === UserRole.ADMIN || actor?.role === UserRole.STAFF;
  }

  private activeFilter(actor?: AccessActor | null) {
    return VideosService.isCurator(actor) ? {} : { isActive: true };
  }

  private migrationDone = false;

  // --- Ensure Migration from Legacy VideoExam / VideoChapter ---
  private async ensureMigration() {
    if (this.migrationDone) return;
    this.migrationDone = true;
    try {
      const exams = await this.prisma.videoExam.findMany({
        include: { chapters: { include: { videos: true } } },
      });
      for (const exam of exams) {
        let topFolder = await this.prisma.videoFolder.findFirst({
          where: { name: exam.title, parentId: null },
        });
        if (!topFolder) {
          topFolder = await this.prisma.videoFolder.create({
            data: {
              name: exam.title,
              description: exam.description,
              orderIndex: exam.orderIndex,
              isActive: exam.isActive,
            },
          });
        }
        for (const ch of exam.chapters) {
          let sub = await this.prisma.videoFolder.findFirst({
            where: { name: ch.title, parentId: topFolder.id },
          });
          if (!sub) {
            sub = await this.prisma.videoFolder.create({
              data: {
                name: ch.title,
                description: ch.description,
                parentId: topFolder.id,
                orderIndex: ch.orderIndex,
                isActive: ch.isActive,
              },
            });
          }
          for (const v of ch.videos) {
            if (!v.folderId) {
              await this.prisma.video.update({
                where: { id: v.id },
                data: { folderId: sub.id },
              });
            }
          }
        }
      }
    } catch {
      // Ignore migration errors if tables are already in sync
    }
  }

  private computeRecursiveCounts(allFolders: { id: string; parentId: string | null }[], directCountMap: Record<string, number>): Record<string, number> {
    const childrenMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (f.parentId) {
        const existing = childrenMap.get(f.parentId) || [];
        existing.push(f.id);
        childrenMap.set(f.parentId, existing);
      }
    }

    const memo = new Map<string, number>();

    const getCount = (folderId: string): number => {
      if (memo.has(folderId)) return memo.get(folderId)!;
      let total = directCountMap[folderId] || 0;
      const childIds = childrenMap.get(folderId) || [];
      for (const cId of childIds) {
        total += getCount(cId);
      }
      memo.set(folderId, total);
      return total;
    };

    const result: Record<string, number> = {};
    for (const f of allFolders) {
      result[f.id] = getCount(f.id);
    }
    return result;
  }

  // --- Video Folders (Recursive Tree) ---

  async listFolders(actor?: AccessActor | null, parentId?: string | null) {
    await this.ensureMigration();
    const isCurator = VideosService.isCurator(actor);
    const where: any = this.activeFilter(actor);

    if (parentId !== undefined && parentId !== null) {
      if (parentId === 'root' || parentId === 'null' || parentId === '') {
        where.parentId = null;
      } else {
        where.parentId = parentId;
      }
    }

    const [folders, allFolders, videoGroupCounts] = await Promise.all([
      this.prisma.videoFolder.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        include: {
          parent: true,
          _count: {
            select: {
              children: isCurator ? true : { where: { isActive: true } },
              videos: isCurator ? true : { where: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.videoFolder.findMany({
        where: isCurator ? {} : { isActive: true },
        select: { id: true, parentId: true },
      }),
      this.prisma.video.groupBy({
        by: ['folderId'],
        where: isCurator ? { folderId: { not: null } } : { folderId: { not: null }, isActive: true },
        _count: { id: true },
      }),
    ]);

    const directCountMap: Record<string, number> = {};
    for (const g of videoGroupCounts) {
      if (g.folderId) {
        directCountMap[g.folderId] = g._count.id;
      }
    }
    const recursiveCounts = this.computeRecursiveCounts(allFolders, directCountMap);

    const mapped = folders.map((f) => ({
      id: f.id,
      name: f.name,
      title: f.name,
      parentId: f.parentId,
      parentName: f.parent?.name || null,
      description: f.description,
      orderIndex: f.orderIndex,
      isActive: f.isActive,
      subFolderCount: f._count.children,
      videoCount: recursiveCounts[f.id] !== undefined ? recursiveCounts[f.id] : f._count.videos,
      directVideoCount: f._count.videos,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    return mapped;
  }

  async findFolder(folderId: string, actor?: AccessActor | null) {
    const isCurator = VideosService.isCurator(actor);
    const [folder, allFolders, videoGroupCounts] = await Promise.all([
      this.prisma.videoFolder.findUnique({
        where: { id: folderId },
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
          children: {
            where: this.activeFilter(actor),
            orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
            include: {
              _count: {
                select: {
                  children: true,
                  videos: true,
                },
              },
            },
          },
          videos: {
            where: this.activeFilter(actor),
            orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.videoFolder.findMany({
        where: isCurator ? {} : { isActive: true },
        select: { id: true, parentId: true },
      }),
      this.prisma.video.groupBy({
        by: ['folderId'],
        where: isCurator ? { folderId: { not: null } } : { folderId: { not: null }, isActive: true },
        _count: { id: true },
      }),
    ]);

    if (!folder) throw new NotFoundException('Video folder not found');

    const directCountMap: Record<string, number> = {};
    for (const g of videoGroupCounts) {
      if (g.folderId) {
        directCountMap[g.folderId] = g._count.id;
      }
    }
    const recursiveCounts = this.computeRecursiveCounts(allFolders, directCountMap);

    if (!folder || (!folder.isActive && !VideosService.isCurator(actor))) {
      throw new NotFoundException('Video folder not found');
    }

    // Build breadcrumbs array
    const breadcrumbs: { id: string; name: string }[] = [];
    let curr: any = folder;
    while (curr) {
      breadcrumbs.unshift({ id: curr.id, name: curr.name });
      curr = curr.parent;
    }

    const mappedChildren = folder.children.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.name,
      parentId: c.parentId,
      description: c.description,
      orderIndex: c.orderIndex,
      isActive: c.isActive,
      subFolderCount: c._count.children,
      videoCount: recursiveCounts[c.id] !== undefined ? recursiveCounts[c.id] : c._count.videos,
      directVideoCount: c._count.videos,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      ...folder,
      breadcrumbs,
      subFolderCount: mappedChildren.length,
      videoCount: recursiveCounts[folder.id] !== undefined ? recursiveCounts[folder.id] : folder.videos.length,
      directVideoCount: folder.videos.length,
      children: mappedChildren,
    };
  }

  async createFolder(dto: { name: string; parentId?: string | null; description?: string; isActive?: boolean }) {
    if (dto.parentId) {
      const parent = await this.prisma.videoFolder.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    return this.prisma.videoFolder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId || null,
        description: dto.description || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async updateFolder(folderId: string, dto: { name?: string; parentId?: string | null; description?: string; isActive?: boolean; orderIndex?: number }) {
    await this.findFolder(folderId, CURATOR);
    return this.prisma.videoFolder.update({
      where: { id: folderId },
      data: dto,
    });
  }

  async removeFolder(folderId: string) {
    const folder = await this.findFolder(folderId, CURATOR);

    // Recursively collect all descendant folder IDs
    const getAllChildren = async (parentId: string): Promise<string[]> => {
      const children = await this.prisma.videoFolder.findMany({
        where: { parentId },
        select: { id: true },
      });
      let ids = children.map((c) => c.id);
      for (const childId of ids) {
        const subIds = await getAllChildren(childId);
        ids = [...ids, ...subIds];
      }
      return ids;
    };

    const allDescendantIds = await getAllChildren(folderId);
    const allFolderIdsToDelete = [folderId, ...allDescendantIds];

    // 1. Delete all videos attached to this folder and its subfolders
    await this.prisma.video.deleteMany({
      where: { folderId: { in: allFolderIdsToDelete } },
    });

    // 2. Clean up any legacy VideoExam and VideoChapter records with matching id or title
    await this.prisma.videoExam.deleteMany({
      where: { OR: [{ id: { in: allFolderIdsToDelete } }, { title: folder.name }] },
    }).catch(() => {});
    await this.prisma.videoChapter.deleteMany({
      where: { OR: [{ id: { in: allFolderIdsToDelete } }, { title: folder.name }] },
    }).catch(() => {});

    // 3. Delete subfolders bottom-up
    for (const subId of allDescendantIds.reverse()) {
      await this.prisma.videoFolder.delete({ where: { id: subId } }).catch(() => {});
    }

    // 4. Delete the target folder
    return this.prisma.videoFolder.delete({
      where: { id: folderId },
    });
  }

  async reorderFolders(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.videoFolder.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        }),
      ),
    );
    return this.listFolders(CURATOR);
  }

  // --- Videos ---

  async listVideos(params: { folderId?: string; chapterId?: string; search?: string }, actor?: AccessActor | null) {
    const where: any = { ...this.activeFilter(actor) };

    if (params.folderId && params.chapterId) {
      where.OR = [{ folderId: params.folderId }, { chapterId: params.chapterId }];
    } else if (params.folderId) {
      where.OR = [{ folderId: params.folderId }, { chapterId: params.folderId }];
    } else if (params.chapterId) {
      where.OR = [{ folderId: params.chapterId }, { chapterId: params.chapterId }];
    }

    if (params.search) {
      const searchFilter = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    return this.prisma.video.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findVideo(videoId: string, actor?: AccessActor | null) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { folder: true, chapter: { include: { exam: true } } },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (!VideosService.isCurator(actor) && !video.isActive) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async createVideo(dto: CreateVideoDto) {
    const { youtubeUrl, folderId, chapterId, ...rest } = dto;
    if (!folderId && !chapterId) {
      throw new BadRequestException('Either folderId or chapterId is required');
    }

    if (folderId) {
      await this.findFolder(folderId, CURATOR);
    } else if (chapterId) {
      await this.findChapter(chapterId, CURATOR);
    }

    return this.prisma.video.create({
      data: {
        ...rest,
        folderId: folderId || null,
        chapterId: chapterId || null,
        ...parseYoutubeLink(youtubeUrl),
      },
    });
  }

  async updateVideo(videoId: string, dto: UpdateVideoDto) {
    await this.findVideo(videoId, CURATOR);
    const { youtubeUrl, ...rest } = dto;
    return this.prisma.video.update({
      where: { id: videoId },
      data: {
        ...rest,
        ...(youtubeUrl ? parseYoutubeLink(youtubeUrl) : {}),
      },
    });
  }

  async removeVideo(videoId: string) {
    await this.findVideo(videoId, CURATOR);
    return this.prisma.video.delete({ where: { id: videoId } });
  }

  async reorderVideos(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.video.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return { success: true };
  }

  async uploadVideoPdf(videoId: string, file: Express.Multer.File) {
    const video = await this.findVideo(videoId, CURATOR);
    if (!file) throw new BadRequestException('No file was uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files can be uploaded');
    }

    const url = await this.storageService.upload(
      'library-pdfs',
      `video-pdfs/${video.folderId || video.chapterId || 'general'}/${videoId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.video.update({
      where: { id: videoId },
      data: {
        pdfUrl: url,
        pdfFileName: file.originalname,
        pdfSizeBytes: file.size,
      },
    });
    await this.storageService.removeReplacedFile(video.pdfUrl, url, videoId);
    return updated;
  }

  async removeVideoPdf(videoId: string) {
    await this.findVideo(videoId, CURATOR);
    return this.prisma.video.update({
      where: { id: videoId },
      data: {
        pdfUrl: null,
        pdfFileName: null,
        pdfSizeBytes: null,
      },
    });
  }

  // --- Legacy Backwards Compatibility (Exams & Chapters) ---

  async listExams(actor?: AccessActor | null) {
    return this.listFolders(actor, 'root');
  }

  async findExam(examId: string, actor?: AccessActor | null) {
    return this.findFolder(examId, actor);
  }

  async createExam(dto: CreateLibraryFolderDto) {
    return this.createFolder({ name: dto.title, description: dto.description, isActive: dto.isActive });
  }

  async updateExam(examId: string, dto: UpdateLibraryFolderDto) {
    return this.updateFolder(examId, { name: dto.title, description: dto.description, isActive: dto.isActive, orderIndex: dto.orderIndex });
  }

  async removeExam(examId: string) {
    return this.removeFolder(examId);
  }

  async reorderExams(dto: ReorderDto) {
    return this.reorderFolders(dto);
  }

  async listChapters(examId: string, actor?: AccessActor | null) {
    return this.listFolders(actor, examId);
  }

  async findChapter(chapterId: string, actor?: AccessActor | null) {
    return this.findFolder(chapterId, actor);
  }

  async createChapter(examId: string, dto: CreateLibraryFolderDto) {
    return this.createFolder({ name: dto.title, parentId: examId, description: dto.description, isActive: dto.isActive });
  }

  async updateChapter(chapterId: string, dto: UpdateLibraryFolderDto) {
    return this.updateFolder(chapterId, { name: dto.title, description: dto.description, isActive: dto.isActive, orderIndex: dto.orderIndex });
  }

  async removeChapter(chapterId: string) {
    return this.removeFolder(chapterId);
  }

  async reorderChapters(examId: string, dto: ReorderDto) {
    return this.reorderFolders(dto);
  }
}

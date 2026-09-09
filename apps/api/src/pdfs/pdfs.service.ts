import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AccessActor } from '../common/access/quiz-access.service';
import { CreateLibraryFolderDto, ReorderDto, UpdateLibraryFolderDto } from '../common/dto/library-folder.dto';
import { CreatePdfDocumentDto, UpdatePdfDocumentDto } from './dto/pdf-document.dto';

const PDF_BUCKET = 'library-pdfs';
const CURATOR: AccessActor = { id: '', role: UserRole.ADMIN };

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

  private migrationDone = false;

  // --- Ensure Migration from Legacy PdfExam / PdfChapter ---
  private async ensureMigration() {
    if (this.migrationDone) return;
    this.migrationDone = true;
    try {
      const exams = await this.prisma.pdfExam.findMany({
        include: { chapters: { include: { documents: true } } },
      });
      for (const exam of exams) {
        let topFolder = await this.prisma.pdfFolder.findFirst({
          where: { name: exam.title, parentId: null },
        });
        if (!topFolder) {
          topFolder = await this.prisma.pdfFolder.create({
            data: {
              name: exam.title,
              description: exam.description,
              orderIndex: exam.orderIndex,
              isActive: exam.isActive,
            },
          });
        }
        for (const ch of exam.chapters) {
          let sub = await this.prisma.pdfFolder.findFirst({
            where: { name: ch.title, parentId: topFolder.id },
          });
          if (!sub) {
            sub = await this.prisma.pdfFolder.create({
              data: {
                name: ch.title,
                description: ch.description,
                parentId: topFolder.id,
                orderIndex: ch.orderIndex,
                isActive: ch.isActive,
              },
            });
          }
          for (const doc of ch.documents) {
            if (!doc.folderId) {
              await this.prisma.pdfDocument.update({
                where: { id: doc.id },
                data: { folderId: sub.id },
              });
            }
          }
        }
      }
    } catch {
      // Ignore migration errors
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

  // --- PDF Folders (Recursive Tree) ---

  async listFolders(actor?: AccessActor | null, parentId?: string | null) {
    await this.ensureMigration();
    const isCurator = PdfsService.isCurator(actor);
    const where: any = this.activeFilter(actor);

    if (parentId !== undefined && parentId !== null) {
      if (parentId === 'root' || parentId === 'null' || parentId === '') {
        where.parentId = null;
      } else {
        where.parentId = parentId;
      }
    }

    const [folders, allFolders, docGroupCounts] = await Promise.all([
      this.prisma.pdfFolder.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        include: {
          parent: true,
          _count: {
            select: {
              children: isCurator ? true : { where: { isActive: true } },
              documents: isCurator ? true : { where: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.pdfFolder.findMany({
        where: isCurator ? {} : { isActive: true },
        select: { id: true, parentId: true },
      }),
      this.prisma.pdfDocument.groupBy({
        by: ['folderId'],
        where: isCurator ? { folderId: { not: null } } : { folderId: { not: null }, isActive: true },
        _count: { id: true },
      }),
    ]);

    const directCountMap: Record<string, number> = {};
    for (const g of docGroupCounts) {
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
      documentCount: recursiveCounts[f.id] !== undefined ? recursiveCounts[f.id] : f._count.documents,
      directDocumentCount: f._count.documents,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    return mapped;
  }

  async findFolder(folderId: string, actor?: AccessActor | null) {
    const isCurator = PdfsService.isCurator(actor);
    const [folder, allFolders, docGroupCounts] = await Promise.all([
      this.prisma.pdfFolder.findUnique({
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
                  documents: true,
                },
              },
            },
          },
          documents: {
            where: this.activeFilter(actor),
            orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.pdfFolder.findMany({
        where: isCurator ? {} : { isActive: true },
        select: { id: true, parentId: true },
      }),
      this.prisma.pdfDocument.groupBy({
        by: ['folderId'],
        where: isCurator ? { folderId: { not: null } } : { folderId: { not: null }, isActive: true },
        _count: { id: true },
      }),
    ]);

    if (!folder) throw new NotFoundException('PDF folder not found');

    const directCountMap: Record<string, number> = {};
    for (const g of docGroupCounts) {
      if (g.folderId) {
        directCountMap[g.folderId] = g._count.id;
      }
    }
    const recursiveCounts = this.computeRecursiveCounts(allFolders, directCountMap);

    if (!folder || (!folder.isActive && !PdfsService.isCurator(actor))) {
      throw new NotFoundException('PDF folder not found');
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
      documentCount: recursiveCounts[c.id] !== undefined ? recursiveCounts[c.id] : c._count.documents,
      directDocumentCount: c._count.documents,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return {
      ...folder,
      breadcrumbs,
      subFolderCount: mappedChildren.length,
      documentCount: recursiveCounts[folder.id] !== undefined ? recursiveCounts[folder.id] : folder.documents.length,
      directDocumentCount: folder.documents.length,
      children: mappedChildren,
    };
  }

  async createFolder(dto: { name: string; parentId?: string | null; description?: string; isActive?: boolean }) {
    if (dto.parentId) {
      const parent = await this.prisma.pdfFolder.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    return this.prisma.pdfFolder.create({
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
    return this.prisma.pdfFolder.update({
      where: { id: folderId },
      data: dto,
    });
  }

  async removeFolder(folderId: string) {
    const folder = await this.findFolder(folderId, CURATOR);

    // Recursively collect all descendant folder IDs
    const getAllChildren = async (parentId: string): Promise<string[]> => {
      const children = await this.prisma.pdfFolder.findMany({
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

    // 1. Delete all documents attached to this folder and its subfolders
    await this.prisma.pdfDocument.deleteMany({
      where: { folderId: { in: allFolderIdsToDelete } },
    });

    // 2. Clean up any legacy PdfExam and PdfChapter records with matching id or title
    await this.prisma.pdfExam.deleteMany({
      where: { OR: [{ id: { in: allFolderIdsToDelete } }, { title: folder.name }] },
    }).catch(() => {});
    await this.prisma.pdfChapter.deleteMany({
      where: { OR: [{ id: { in: allFolderIdsToDelete } }, { title: folder.name }] },
    }).catch(() => {});

    // 3. Delete subfolders bottom-up
    for (const subId of allDescendantIds.reverse()) {
      await this.prisma.pdfFolder.delete({ where: { id: subId } }).catch(() => {});
    }

    // 4. Delete the target folder
    return this.prisma.pdfFolder.delete({
      where: { id: folderId },
    });
  }

  async reorderFolders(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pdfFolder.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        }),
      ),
    );
    return this.listFolders(CURATOR);
  }

  // --- PDF Documents ---

  async listDocuments(params: { folderId?: string; chapterId?: string; search?: string }, actor?: AccessActor | null) {
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

    return this.prisma.pdfDocument.findMany({
      where,
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findDocument(documentId: string, actor?: AccessActor | null) {
    const doc = await this.prisma.pdfDocument.findUnique({
      where: { id: documentId },
      include: { folder: true, chapter: { include: { exam: true } } },
    });
    if (!doc) throw new NotFoundException('PDF document not found');
    if (!PdfsService.isCurator(actor) && !doc.isActive) {
      throw new NotFoundException('PDF document not found');
    }
    return doc;
  }

  async createDocument(dto: CreatePdfDocumentDto) {
    const { folderId, chapterId, ...rest } = dto;
    if (!folderId && !chapterId) {
      throw new BadRequestException('Either folderId or chapterId is required');
    }

    if (folderId) {
      await this.findFolder(folderId, CURATOR);
    } else if (chapterId) {
      await this.findChapter(chapterId, CURATOR);
    }

    return this.prisma.pdfDocument.create({
      data: {
        ...rest,
        folderId: folderId || null,
        chapterId: chapterId || null,
      },
    });
  }

  async updateDocument(documentId: string, dto: UpdatePdfDocumentDto) {
    await this.findDocument(documentId, CURATOR);
    return this.prisma.pdfDocument.update({
      where: { id: documentId },
      data: dto,
    });
  }

  async removeDocument(documentId: string) {
    await this.findDocument(documentId, CURATOR);
    return this.prisma.pdfDocument.delete({ where: { id: documentId } });
  }

  async reorderDocuments(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pdfDocument.update({ where: { id: item.id }, data: { orderIndex: item.orderIndex } }),
      ),
    );
    return { success: true };
  }

  async uploadPdfFile(documentId: string, file: Express.Multer.File) {
    const doc = await this.findDocument(documentId, CURATOR);
    if (!file) throw new BadRequestException('No file was uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files can be uploaded');
    }

    const url = await this.storageService.upload(
      PDF_BUCKET,
      `documents/${doc.folderId || doc.chapterId || 'general'}/${documentId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );

    const updated = await this.prisma.pdfDocument.update({
      where: { id: documentId },
      data: {
        fileUrl: url,
        fileName: file.originalname,
        fileSizeBytes: file.size,
      },
    });
    // Only now that the replacement is stored and the record points at it.
    await this.storageService.removeReplacedFile(doc.fileUrl, url, documentId);
    return updated;
  }

  async removePdfFile(documentId: string) {
    await this.findDocument(documentId, CURATOR);
    return this.prisma.pdfDocument.update({
      where: { id: documentId },
      data: {
        fileUrl: null,
        fileName: null,
        fileSizeBytes: null,
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

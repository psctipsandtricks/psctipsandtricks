import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePdfHighlightDto } from './dto/create-pdf-highlight.dto';

/** The wire shape both clients read. */
export interface PdfHighlightDto {
  id: string;
  documentKey: string;
  page: number;
  points: number[];
  color: number;
  width: number;
  createdAt: string;
}

/**
 * A student's marker strokes on book PDFs.
 *
 * Every method takes the caller's id and scopes on it. That is the whole
 * security model and it is deliberately not delegated to a guard: highlights
 * are private notes on shared study material, so "which user" belongs in the
 * `where` clause of each query rather than in a check that could be forgotten
 * at one call site.
 */
@Injectable()
export class PdfHighlightsService {
  constructor(private prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    documentKey: string;
    page: number;
    points: unknown;
    color: number;
    width: number;
    createdAt: Date;
  }): PdfHighlightDto {
    return {
      id: row.id,
      documentKey: row.documentKey,
      page: row.page,
      // Stored as JSON, so a row hand-edited to something else must not reach a
      // client that will try to draw it.
      points: Array.isArray(row.points)
        ? (row.points as unknown[]).filter((n): n is number => typeof n === 'number')
        : [],
      color: row.color,
      width: row.width,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** This caller's strokes on one document, in the order they were drawn. */
  async list(userId: string, documentKey: string): Promise<PdfHighlightDto[]> {
    const rows = await this.prisma.pdfHighlight.findMany({
      where: { userId, documentKey },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userId: string, dto: CreatePdfHighlightDto): Promise<PdfHighlightDto> {
    const row = await this.prisma.pdfHighlight.create({
      data: {
        userId,
        documentKey: dto.documentKey,
        page: dto.page,
        // Clamped here rather than trusted: a point outside the page box would
        // draw a highlight off the edge of the paper on every client.
        points: dto.points.map((n) => Math.min(1, Math.max(0, n))),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
      },
    });
    return this.toDto(row);
  }

  /**
   * Removes strokes by id, and reports how many actually went.
   *
   * Scoped to the caller, so an id belonging to somebody else simply matches
   * nothing — there is no "not found" to distinguish, and nothing to learn from
   * the count about whether that id exists.
   */
  async erase(userId: string, ids: string[]): Promise<{ deleted: number }> {
    const { count } = await this.prisma.pdfHighlight.deleteMany({
      where: { userId, id: { in: ids } },
    });
    return { deleted: count };
  }
}

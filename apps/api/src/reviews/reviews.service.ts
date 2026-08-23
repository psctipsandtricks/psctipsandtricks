import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

/** Reviews are curated by hand, so the admin-chosen order wins over recency. */
const REVIEW_ORDER = [{ orderIndex: 'asc' as const }, { createdAt: 'desc' as const }];

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /** Every review, active or not — the admin table. */
  async findAll() {
    return this.prisma.customerReview.findMany({ orderBy: REVIEW_ORDER });
  }

  /** Only the reviews an admin has enabled — what the home page rail shows. */
  async findActive() {
    return this.prisma.customerReview.findMany({
      where: { isActive: true },
      orderBy: REVIEW_ORDER,
    });
  }

  async create(dto: CreateReviewDto) {
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const highest = await this.prisma.customerReview.findFirst({
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      orderIndex = (highest?.orderIndex ?? -1) + 1;
    }

    return this.prisma.customerReview.create({
      data: {
        customerName: dto.customerName.trim(),
        rating: dto.rating,
        comment: dto.comment.trim(),
        isActive: dto.isActive ?? true,
        orderIndex,
      },
    });
  }

  /**
   * Partial update — also serves the plain enable/disable toggle, which sends
   * `{ isActive }` alone and relies on every other field staying untouched.
   */
  async update(id: string, dto: UpdateReviewDto) {
    const existing = await this.prisma.customerReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');

    return this.prisma.customerReview.update({
      where: { id },
      data: {
        ...(dto.customerName !== undefined && { customerName: dto.customerName.trim() }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.comment !== undefined && { comment: dto.comment.trim() }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
      },
    });
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.customerReview.update({ where: { id }, data: { orderIndex: index } }),
      ),
    );
    return this.findAll();
  }

  async remove(id: string) {
    const existing = await this.prisma.customerReview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    return this.prisma.customerReview.delete({ where: { id } });
  }
}

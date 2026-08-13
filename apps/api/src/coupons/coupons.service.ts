import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateCoupon(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Invalid or inactive coupon code');
    }

    if (new Date(coupon.validTill) < new Date()) {
      throw new BadRequestException('Coupon code has expired');
    }

    return coupon;
  }

  async create(data: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountPercent: data.discountPercent,
        maxDiscountAmount: data.maxDiscountAmount,
        validTill: new Date(data.validTill),
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Partial update — also used for the plain enable/disable toggle, which
   * sends `{ isActive }` alone and relies on every other field being
   * left untouched.
   */
  async update(id: string, data: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const nextCode = data.code ? data.code.trim().toUpperCase() : undefined;
    if (nextCode && nextCode !== existing.code) {
      const clash = await this.prisma.coupon.findUnique({ where: { code: nextCode } });
      if (clash) throw new BadRequestException('A coupon with this code already exists');
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(nextCode !== undefined && { code: nextCode }),
        ...(data.discountPercent !== undefined && { discountPercent: data.discountPercent }),
        ...(data.maxDiscountAmount !== undefined && { maxDiscountAmount: data.maxDiscountAmount }),
        ...(data.validTill !== undefined && { validTill: new Date(data.validTill) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }
}

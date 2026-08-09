import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

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

  async remove(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }
}

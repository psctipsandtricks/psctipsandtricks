import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserRole, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  isPremium: true,
  avatarUrl: true,
  googleAvatarUrl: true,
  phoneNumber: true,
  oauthIdentities: { select: { provider: true } },
  staffPermission: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      orders: { where: { status: OrderStatus.SUCCESS } },
      submissions: true,
    },
  },
};

function withCounts<T extends { _count: { orders: number; submissions: number } }>(user: T) {
  const { _count, ...rest } = user;
  return { ...rest, ordersCount: _count.orders, quizAttemptsCount: _count.submissions };
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async findAll(query?: { page?: number; limit?: number; search?: string; provider?: string }) {
    const where: any = { role: 'STUDENT' };

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phoneNumber: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query?.provider && query.provider !== 'ALL') {
      const p = query.provider.toUpperCase();
      if (p === 'GOOGLE') {
        where.OR = [
          ...(where.OR || []),
          { oauthIdentities: { some: { provider: 'GOOGLE' } } },
          { email: { endsWith: '@gmail.com', mode: 'insensitive' } },
          { email: { endsWith: '@googlemail.com', mode: 'insensitive' } },
        ];
      } else if (p === 'APPLE') {
        where.OR = [
          ...(where.OR || []),
          { oauthIdentities: { some: { provider: 'APPLE' } } },
          { email: { endsWith: '@icloud.com', mode: 'insensitive' } },
          { email: { endsWith: '@apple.com', mode: 'insensitive' } },
        ];
      } else if (p === 'EMAIL') {
        where.AND = [
          ...(where.AND || []),
          { oauthIdentities: { none: {} } },
          {
            NOT: [
              { email: { endsWith: '@gmail.com', mode: 'insensitive' } },
              { email: { endsWith: '@googlemail.com', mode: 'insensitive' } },
              { email: { endsWith: '@icloud.com', mode: 'insensitive' } },
              { email: { endsWith: '@apple.com', mode: 'insensitive' } },
            ],
          },
        ];
      }
    }

    if (query?.page || query?.limit) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
      const skip = (page - 1) * limit;

      const [total, users] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: SAFE_SELECT,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        data: users.map(withCounts),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return users.map(withCounts);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return withCounts(user);
  }

  async updateProfile(id: string, data: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
    return withCounts(user);
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException('No image file provided');

    const url = await this.storageService.upload(
      'avatars',
      `${id}/${Date.now()}-${file.originalname}`,
      file.buffer,
      file.mimetype,
    );
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: url },
      select: SAFE_SELECT,
    });
    return withCounts(user);
  }

  async removeAvatar(id: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: null },
      select: SAFE_SELECT,
    });
    return withCounts(user);
  }

  async createStudent(dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }
    const rawPassword = dto.password || Math.random().toString(36).slice(-8) + 'Aa1!';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        role: dto.role ?? UserRole.STUDENT,
        isPremium: dto.isPremium ?? false,
      },
      select: SAFE_SELECT,
    });
    return withCounts(user);
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });
    return withCounts(user);
  }

  async deleteUser(id: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (requesterId && requesterId === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.updateMany({
        where: { sentById: id },
        data: { sentById: null },
      });

      await tx.staffPermission.updateMany({
        where: { grantedById: id },
        data: { grantedById: null },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    return {
      success: true,
      message: `User account (${user.email}) deleted successfully`,
      id,
    };
  }
}

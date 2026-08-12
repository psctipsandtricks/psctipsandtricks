import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserRole } from '@prisma/client';
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
  createdAt: true,
  updatedAt: true,
  _count: { select: { orders: true, submissions: true } },
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

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
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
    const hashedPassword = await bcrypt.hash(dto.password, 10);
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
}

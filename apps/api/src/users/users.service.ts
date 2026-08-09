import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  isPremium: true,
  avatarUrl: true,
  phoneNumber: true,
  oauthIdentities: { select: { provider: true } },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async invite(dto: InviteStaffDto, invitedById: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const staffUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: UserRole.STAFF,
        staffPermission: {
          create: {
            manageBooks: dto.manageBooks ?? false,
            manageQuizzes: dto.manageQuizzes ?? false,
            manageChat: dto.manageChat ?? false,
            manageCoupons: dto.manageCoupons ?? false,
            manageNotifications: dto.manageNotifications ?? false,
            viewOrders: dto.viewOrders ?? false,
            viewAnalytics: dto.viewAnalytics ?? false,
            manageUsers: false,
            grantedById: invitedById,
          },
        },
      },
      include: { staffPermission: true },
    });

    const { password, ...safeUser } = staffUser;
    return { user: safeUser, temporaryPassword: tempPassword };
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: UserRole.STAFF },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        staffPermission: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findStaffOrThrow(id: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id },
      include: { staffPermission: true },
    });
    if (!staff || staff.role !== UserRole.STAFF) {
      throw new NotFoundException('Staff member not found');
    }
    return staff;
  }

  async updatePermissions(id: string, dto: UpdatePermissionsDto) {
    await this.findStaffOrThrow(id);
    return this.prisma.staffPermission.update({
      where: { userId: id },
      data: dto,
    });
  }

  async setSuspended(id: string, suspended: boolean) {
    await this.findStaffOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
      select: { id: true, email: true, name: true, status: true },
    });
  }
}

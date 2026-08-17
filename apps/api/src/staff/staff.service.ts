import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStaffDto, creatorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const rawPassword = dto.password?.trim() || crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const assignedRole = dto.role || UserRole.STAFF;
    const initialStatus = dto.status || UserStatus.ACTIVE;

    const staffUser = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        name: dto.name.trim(),
        phoneNumber: dto.phoneNumber?.trim() || null,
        password: hashedPassword,
        role: assignedRole,
        status: initialStatus,
        staffPermission: {
          create: {
            manageBooks: dto.manageBooks ?? (assignedRole === UserRole.ADMIN),
            manageQuizzes: dto.manageQuizzes ?? (assignedRole === UserRole.ADMIN),
            manageVideos: dto.manageVideos ?? (assignedRole === UserRole.ADMIN),
            managePdfs: dto.managePdfs ?? (assignedRole === UserRole.ADMIN),
            manageUsers: dto.manageUsers ?? (assignedRole === UserRole.ADMIN),
            manageChat: dto.manageChat ?? (assignedRole === UserRole.ADMIN),
            viewOrders: dto.viewOrders ?? (assignedRole === UserRole.ADMIN),
            manageOrders: dto.manageOrders ?? (assignedRole === UserRole.ADMIN),
            manageCoupons: dto.manageCoupons ?? (assignedRole === UserRole.ADMIN),
            manageNotifications: dto.manageNotifications ?? (assignedRole === UserRole.ADMIN),
            manageAnnouncements: dto.manageAnnouncements ?? (assignedRole === UserRole.ADMIN),
            manageStaff: dto.manageStaff ?? (assignedRole === UserRole.ADMIN),
            viewAnalytics: dto.viewAnalytics ?? (assignedRole === UserRole.ADMIN),
            grantedById: creatorId,
          },
        },
      },
      include: { staffPermission: true },
    });

    const { password, ...safeUser } = staffUser;
    return {
      user: safeUser,
      generatedPassword: dto.password ? undefined : rawPassword,
    };
  }

  async findAll(query?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: { in: [UserRole.ADMIN, UserRole.STAFF] },
    };

    if (query?.role && (query.role === 'ADMIN' || query.role === 'STAFF')) {
      where.role = query.role as UserRole;
    }

    if (query?.status && (query.status === 'ACTIVE' || query.status === 'SUSPENDED')) {
      where.status = query.status as UserStatus;
    }

    if (query?.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          role: true,
          status: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
          staffPermission: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async findStaffOrThrow(id: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id },
      include: { staffPermission: true },
    });
    if (!staff || (staff.role !== UserRole.STAFF && staff.role !== UserRole.ADMIN)) {
      throw new NotFoundException('Staff account not found');
    }
    return staff;
  }

  async update(id: string, dto: UpdateStaffDto, currentUserId: string) {
    const staff = await this.findStaffOrThrow(id);

    // Prevent a user from changing their own role/status to avoid lockouts
    if (id === currentUserId && dto.role && dto.role !== staff.role) {
      throw new ForbiddenException('You cannot modify your own administrative role');
    }

    if (dto.email && dto.email.trim().toLowerCase() !== staff.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('A user with this email already exists');
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (dto.name) updateData.name = dto.name.trim();
    if (dto.email) updateData.email = dto.email.trim().toLowerCase();
    if (dto.phoneNumber !== undefined) updateData.phoneNumber = dto.phoneNumber?.trim() || null;
    if (dto.role) updateData.role = dto.role;
    if (dto.status) updateData.status = dto.status;
    if (dto.password && dto.password.trim()) {
      updateData.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        staffPermission: true,
      },
    });

    return updated;
  }

  async updatePermissions(id: string, dto: UpdatePermissionsDto) {
    await this.findStaffOrThrow(id);

    return this.prisma.staffPermission.upsert({
      where: { userId: id },
      create: {
        userId: id,
        manageBooks: dto.manageBooks ?? false,
        manageQuizzes: dto.manageQuizzes ?? false,
        manageVideos: dto.manageVideos ?? false,
        managePdfs: dto.managePdfs ?? false,
        manageUsers: dto.manageUsers ?? false,
        manageChat: dto.manageChat ?? false,
        viewOrders: dto.viewOrders ?? false,
        manageOrders: dto.manageOrders ?? false,
        manageCoupons: dto.manageCoupons ?? false,
        manageNotifications: dto.manageNotifications ?? false,
        manageAnnouncements: dto.manageAnnouncements ?? false,
        manageStaff: dto.manageStaff ?? false,
        viewAnalytics: dto.viewAnalytics ?? false,
      },
      update: dto,
    });
  }

  async resetPassword(id: string, newPassword?: string) {
    await this.findStaffOrThrow(id);
    const passToSet = newPassword?.trim() || crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(passToSet, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { success: true, password: passToSet };
  }

  async setSuspended(id: string, suspended: boolean, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    await this.findStaffOrThrow(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        staffPermission: true,
      },
    });
  }

  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    await this.findStaffOrThrow(id);

    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'Staff member removed successfully' };
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY, StaffPermissionKey } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<StaffPermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.role === UserRole.ADMIN) return true;
    if (user.role !== UserRole.STAFF) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    const permission = await this.prisma.staffPermission.findUnique({ where: { userId: user.id } });
    const hasAll = permission && requiredPermissions.every((key) => permission[key] === true);
    if (!hasAll) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}

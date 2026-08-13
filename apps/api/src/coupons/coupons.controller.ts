import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

const MANAGE_COUPONS_GUARDS = [JwtAuthGuard, RolesGuard, PermissionsGuard];

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @ApiOperation({ summary: 'List all discount coupon codes (Admin / Staff with manage_coupons)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_COUPONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageCoupons')
  @Get()
  async findAll() {
    return this.couponsService.findAll();
  }

  @ApiOperation({ summary: 'Validate coupon code before checkout' })
  @Get('validate')
  async validate(@Query('code') code: string) {
    return this.couponsService.validateCoupon(code);
  }

  @ApiOperation({ summary: 'Create a new coupon code (Admin / Staff with manage_coupons)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_COUPONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageCoupons')
  @Post()
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @ApiOperation({ summary: 'Update a coupon code, or just enable/disable it (Admin / Staff with manage_coupons)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_COUPONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageCoupons')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete coupon code (Admin / Staff with manage_coupons)' })
  @ApiBearerAuth()
  @UseGuards(...MANAGE_COUPONS_GUARDS)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('manageCoupons')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}

import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @ApiOperation({ summary: 'List all discount coupon codes (Admin)' })
  @Get()
  async findAll() {
    return this.couponsService.findAll();
  }

  @ApiOperation({ summary: 'Validate coupon code before checkout' })
  @Get('validate')
  async validate(@Query('code') code: string) {
    return this.couponsService.validateCoupon(code);
  }

  @ApiOperation({ summary: 'Create a new coupon code (Admin)' })
  @Post()
  async create(@Body() body: any) {
    return this.couponsService.create(body);
  }

  @ApiOperation({ summary: 'Delete coupon code (Admin)' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}

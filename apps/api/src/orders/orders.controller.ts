import { Controller, Get, Post, Body, Headers, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserRole } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Create razorpay order' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Verify razorpay payment signature' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verify(@Request() req: any, @Body() dto: VerifyPaymentDto) {
    return this.ordersService.verifyPayment(req.user.id, dto);
  }

  @ApiOperation({ summary: "Get the signed-in student's own purchase history" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMine(@Request() req: any) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @ApiOperation({ summary: 'Razorpay webhook callback' })
  @Post('webhook')
  async webhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.ordersService.handleWebhook(rawBody, signature);
  }

  @ApiOperation({ summary: 'List all orders (Admin / Staff with view_orders)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @RequirePermissions('viewOrders')
  @Get()
  async findAll() {
    return this.ordersService.findAll();
  }
}

import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Create razorpay order' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    return this.ordersService.createOrder(req.user.id, body);
  }

  @ApiOperation({ summary: 'Verify razorpay payment signature' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('verify')
  async verify(@Body() body: { orderId: string; paymentId: string }) {
    return this.ordersService.verifyPayment(body.orderId, body.paymentId);
  }

  @ApiOperation({ summary: 'List all orders (Admin)' })
  @Get()
  async findAll() {
    return this.ordersService.findAll();
  }
}

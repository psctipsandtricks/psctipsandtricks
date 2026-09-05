import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: 499 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'Manual adjustment / support note' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'pay_xxxxxxxx' })
  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @ApiPropertyOptional({ example: '2026-09-03', description: 'Order / purchase date (YYYY-MM-DD or ISO string)' })
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: '2026-09-03', description: 'Alias for purchaseDate' })
  @IsOptional()
  @IsString()
  orderDate?: string;

  @ApiPropertyOptional({ example: '2026-09-03T12:00:00.000Z' })
  @IsOptional()
  @IsString()
  createdAt?: string;
}

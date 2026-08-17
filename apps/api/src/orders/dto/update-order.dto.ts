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
}

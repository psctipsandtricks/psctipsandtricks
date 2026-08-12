import { IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  paymentId: string;

  @IsOptional()
  @IsString()
  razorpayOrderId?: string;

  @IsOptional()
  @IsString()
  razorpaySignature?: string;
}

import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  discountPercent: number;

  @IsNumber()
  @Min(0)
  maxDiscountAmount: number;

  @IsDateString()
  validTill: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

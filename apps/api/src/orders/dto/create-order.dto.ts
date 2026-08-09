import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  quizId?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

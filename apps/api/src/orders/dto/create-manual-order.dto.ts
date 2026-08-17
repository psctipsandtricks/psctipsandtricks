import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateManualOrderDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  quizId?: string;

  /** Defaults to the item's own price when omitted. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

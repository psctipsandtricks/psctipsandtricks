import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  /**
   * The date the purchase should be recorded against (YYYY-MM-DD or full ISO).
   * Defaults to now when omitted. Used as the order's created/paid timestamp.
   */
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  /** Alias for purchaseDate */
  @IsOptional()
  @IsString()
  orderDate?: string;

  /** Alias for purchaseDate */
  @IsOptional()
  @IsString()
  createdAt?: string;
}


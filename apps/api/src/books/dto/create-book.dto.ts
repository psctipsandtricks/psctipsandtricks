import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const BOOK_SUBSCRIPTION_TYPES = ['FULL_TIME_ACCESS', 'LIMITED_ACCESS', 'SUBSCRIPTION'] as const;

export class CreateBookDto {
  @IsString()
  title: string;

  @IsString()
  author: string;

  @IsString()
  description: string;

  @IsString()
  coverUrl: string;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsString()
  previewPdfUrl?: string;

  @IsOptional()
  @IsString()
  previewPdfFileName?: string;

  @IsOptional()
  @IsInt()
  previewPdfSizeBytes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsInt()
  publicationYear?: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  appleId?: string;

  @IsOptional()
  @IsString()
  basePlanId?: string;

  @IsOptional()
  @IsIn(BOOK_SUBSCRIPTION_TYPES)
  subscriptionType?: (typeof BOOK_SUBSCRIPTION_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToGuests?: boolean;
}

import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
  @IsNumber()
  @Min(0)
  price?: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

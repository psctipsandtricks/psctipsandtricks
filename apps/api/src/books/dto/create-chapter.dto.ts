import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ContentStatus } from '@prisma/client';

export class CreateChapterDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @IsOptional()
  @IsString()
  textContent?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertProgressDto {
  @IsString()
  bookId: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent: number;
}

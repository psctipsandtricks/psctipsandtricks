import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertProgressDto {
  @IsString()
  bookId: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent: number;
}

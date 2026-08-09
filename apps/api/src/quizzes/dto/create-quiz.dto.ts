import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuestionDto } from './create-question.dto';

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  folderName?: string;

  @IsOptional()
  @IsString()
  accessType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  bookId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isLiveMock?: boolean;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswerAfterSelection?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarkingValue?: number;

  @IsOptional()
  @IsNumber()
  passingMarks?: number;

  @IsOptional()
  @IsNumber()
  totalMarks?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}

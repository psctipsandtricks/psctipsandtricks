import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuestionDto } from './create-question.dto';

export class CreateQuizDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  folderName?: string;

  @IsOptional()
  @IsString()
  accessType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * ISO timestamp the quiz becomes visible to students. Omit (or send null)
   * for a quiz that is live as soon as it is published. Whether the moment is
   * allowed to be in the past is decided in the service, which can tell a new
   * schedule apart from a re-save of an already-released one.
   */
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

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
  @IsBoolean()
  negativeMarkingEnabled?: boolean;

  // "For every N wrong answers, deduct M marks" — N.
  @IsOptional()
  @IsInt()
  @Min(1)
  negativeMarkingEvery?: number;

  // "For every N wrong answers, deduct M marks" — M.
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarkingDeduct?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeScore?: boolean;

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

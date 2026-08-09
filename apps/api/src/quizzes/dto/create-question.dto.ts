import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class QuestionOptionDto {
  @IsString()
  id: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @IsInt()
  correctOptionIndex: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @Min(0)
  marks?: number;
}

import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SubmittedAnswerDto {
  @IsString()
  questionId: string;

  @IsOptional()
  @IsInt()
  selectedOptionIndex?: number;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers: SubmittedAnswerDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenSeconds?: number;
}

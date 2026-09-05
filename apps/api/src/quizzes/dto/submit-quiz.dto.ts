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

  /**
   * Same duration as `timeTakenSeconds`, to millisecond precision. Mock
   * tests rank ties on this — two participants can easily land on the same
   * whole second, and only the finer value can tell who was actually faster.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenMs?: number;
}

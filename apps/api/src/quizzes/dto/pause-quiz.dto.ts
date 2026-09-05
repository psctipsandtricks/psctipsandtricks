import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class PausedAnswerDto {
  @ApiPropertyOptional()
  @IsString()
  questionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  selectedOptionIndex?: number;
}

export class PauseQuizDto {
  @ApiPropertyOptional({ type: [PausedAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PausedAnswerDto)
  answers?: PausedAnswerDto[];

  @ApiPropertyOptional({ description: 'Seconds elapsed so far in this attempt' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenSeconds?: number;

  @ApiPropertyOptional({ description: 'Current question index when exiting' })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentIndex?: number;
}

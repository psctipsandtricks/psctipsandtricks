import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateMockTestDto {
  @IsString()
  title: string;

  @IsString()
  quizId: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

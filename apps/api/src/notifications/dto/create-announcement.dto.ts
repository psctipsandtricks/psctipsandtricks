import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  endDate: string;
}

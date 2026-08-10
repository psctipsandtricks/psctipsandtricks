import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateChatGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  iconEmoji?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  coverGradient?: string;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

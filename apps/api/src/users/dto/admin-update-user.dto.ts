import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}

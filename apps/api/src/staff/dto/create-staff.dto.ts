import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class CreateStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  manageBooks?: boolean;

  @IsOptional()
  @IsBoolean()
  manageQuizzes?: boolean;

  @IsOptional()
  @IsBoolean()
  manageVideos?: boolean;

  @IsOptional()
  @IsBoolean()
  managePdfs?: boolean;

  @IsOptional()
  @IsBoolean()
  manageUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  manageChat?: boolean;

  @IsOptional()
  @IsBoolean()
  viewOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  manageOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  manageCoupons?: boolean;

  @IsOptional()
  @IsBoolean()
  manageNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  manageAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  manageStaff?: boolean;

  @IsOptional()
  @IsBoolean()
  viewAnalytics?: boolean;
}

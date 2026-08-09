import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  manageBooks?: boolean;

  @IsOptional()
  @IsBoolean()
  manageQuizzes?: boolean;

  @IsOptional()
  @IsBoolean()
  manageChat?: boolean;

  @IsOptional()
  @IsBoolean()
  manageCoupons?: boolean;

  @IsOptional()
  @IsBoolean()
  manageNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  viewOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  viewAnalytics?: boolean;
}

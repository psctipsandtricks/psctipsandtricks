import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionsDto {
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

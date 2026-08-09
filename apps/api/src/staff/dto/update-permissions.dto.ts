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

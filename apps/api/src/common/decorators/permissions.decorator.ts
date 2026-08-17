import { SetMetadata } from '@nestjs/common';

export type StaffPermissionKey =
  | 'manageBooks'
  | 'manageQuizzes'
  | 'manageChat'
  | 'manageCoupons'
  | 'manageNotifications'
  | 'viewOrders'
  | 'manageOrders'
  | 'viewAnalytics'
  | 'manageUsers'
  | 'manageVideos'
  | 'managePdfs';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: StaffPermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

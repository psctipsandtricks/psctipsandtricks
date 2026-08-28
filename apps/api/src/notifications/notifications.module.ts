import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProcessor } from './notification.processor';
import { FcmClient } from './fcm.client';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationProcessor, FcmClient],
  exports: [NotificationsService],
})
export class NotificationsModule {}

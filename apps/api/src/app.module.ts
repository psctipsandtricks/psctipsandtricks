import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config/env.config';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './common/access/access.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BooksModule } from './books/books.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CouponsModule } from './coupons/coupons.module';
import { StorageModule } from './storage/storage.module';
import { LibraryModule } from './library/library.module';
import { StaffModule } from './staff/staff.module';
import { MockTestsModule } from './mock-tests/mock-tests.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    PrismaModule,
    QueueModule,
    AccessModule,
    AuthModule,
    UsersModule,
    BooksModule,
    QuizzesModule,
    OrdersModule,
    AdminModule,
    ChatModule,
    NotificationsModule,
    CouponsModule,
    StorageModule,
    LibraryModule,
    StaffModule,
    MockTestsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}

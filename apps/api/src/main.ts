import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // OpenAPI / Swagger setup
  const config = new DocumentBuilder()
    .setTitle('PSC Tips & Tricks API')
    .setDescription('Comprehensive Ed-Tech REST & WebSocket API documentation for PSC Tips & Tricks platform.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'User registration, login, and JWT tokens')
    .addTag('Users', 'User profiles and accounts')
    .addTag('Books', 'E-books catalog & PDF reader assets')
    .addTag('Quizzes', 'Interactive quizzes, live mock tests, & leaderboards')
    .addTag('Orders', 'Checkout, Razorpay payment processing, and subscriptions')
    .addTag('Admin', 'Administrative metrics and management')
    .addTag('Notifications', 'Push notification dispatch')
    .addTag('Coupons', 'Discount codes and promotional offers')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 NestJS API running on: http://localhost:${port}`);
  logger.log(`📚 OpenAPI / Swagger Docs: http://localhost:${port}/api/docs`);
}

bootstrap();

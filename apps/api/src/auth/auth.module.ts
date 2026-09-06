import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { AppleStrategy } from './apple.strategy';
import { GoogleConfiguredGuard, AppleConfiguredGuard } from './oauth-configured.guard';
import { GoogleAuthGuard, AppleAuthGuard } from './provider-auth.guard';

import { MailService } from './mail.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    JwtStrategy,
    GoogleStrategy,
    AppleStrategy,
    GoogleConfiguredGuard,
    AppleConfiguredGuard,
    GoogleAuthGuard,
    AppleAuthGuard,
  ],
  exports: [AuthService, MailService],
})
export class AuthModule {}

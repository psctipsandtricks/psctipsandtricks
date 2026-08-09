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

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    AppleStrategy,
    GoogleConfiguredGuard,
    AppleConfiguredGuard,
    GoogleAuthGuard,
    AppleAuthGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthProvider } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'unconfigured',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'unconfigured',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Google account has no email address associated with it');
    }
    const name = profile.displayName || email.split('@')[0];
    const avatarUrl = profile.photos?.[0]?.value;

    return this.authService.findOrCreateOAuthUser(
      OAuthProvider.GOOGLE,
      profile.id,
      email,
      name,
      avatarUrl,
    );
  }
}


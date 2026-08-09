import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy = require('passport-apple');
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthProvider } from '@prisma/client';

function decodeIdToken(idToken: string): { sub: string; email?: string } {
  const payload = idToken.split('.')[1];
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID') || 'unconfigured',
      teamID: configService.get<string>('APPLE_TEAM_ID') || 'unconfigured',
      keyID: configService.get<string>('APPLE_KEY_ID') || 'unconfigured',
      privateKeyString:
        (configService.get<string>('APPLE_PRIVATE_KEY') || '').replace(/\\n/g, '\n') ||
        '-----BEGIN PRIVATE KEY-----\nunconfigured\n-----END PRIVATE KEY-----',
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL'),
      scope: ['email', 'name'],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: Record<string, any>,
    done: (err: Error | null, user?: any) => void,
  ) {
    try {
      const decoded = decodeIdToken(idToken);
      const email = decoded.email || profile?.email;
      if (!email) {
        return done(new Error('Apple account has no email'));
      }
      const name = profile?.name
        ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
        : email.split('@')[0];

      const result = await this.authService.findOrCreateOAuthUser(
        OAuthProvider.APPLE,
        decoded.sub,
        email,
        name || email.split('@')[0],
      );
      done(null, result);
    } catch (err) {
      done(err as Error);
    }
  }
}

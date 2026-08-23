import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy = require('passport-apple');
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthProvider } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

function normalizePrivateKey(rawKey?: string): string {
  if (!rawKey) return '';
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n').trim();
}

function parseIdToken(idToken: any): { sub?: string; email?: string } {
  if (!idToken) return {};
  if (typeof idToken === 'object' && idToken.sub) return idToken;
  try {
    const decoded = jwt.decode(idToken);
    if (decoded && typeof decoded === 'object') {
      return decoded as { sub?: string; email?: string };
    }
  } catch (err) {
    Logger.error('Failed to decode Apple idToken', err, 'AppleStrategy');
  }
  return {};
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  private readonly logger = new Logger(AppleStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const rawKey = configService.get<string>('APPLE_PRIVATE_KEY') || '';
    const privateKeyString = normalizePrivateKey(rawKey) || '-----BEGIN PRIVATE KEY-----\nunconfigured\n-----END PRIVATE KEY-----';

    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID') || 'unconfigured',
      teamID: configService.get<string>('APPLE_TEAM_ID') || 'unconfigured',
      keyID: configService.get<string>('APPLE_KEY_ID') || 'unconfigured',
      privateKeyString,
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL'),
      scope: ['email', 'name'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    idToken: any,
    profile: Record<string, any>,
  ) {
    const decoded = parseIdToken(idToken);
    const email = decoded.email || profile?.email || req.appleProfile?.email;
    if (!email) {
      this.logger.error('Apple account has no email associated');
      throw new Error('Apple account has no email associated');
    }

    const sub = decoded.sub || profile?.id || req.appleProfile?.id;
    if (!sub) {
      this.logger.error('Apple account has no sub identifier');
      throw new Error('Apple account has no sub identifier');
    }

    // Apple sends name only on first authorization in req.body.user or req.appleProfile
    let rawName = req?.appleProfile?.name || profile?.name;
    if (!rawName && req?.body?.user) {
      try {
        const parsed = typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user;
        rawName = parsed?.name;
      } catch {
        // ignore
      }
    }

    const name = rawName
      ? `${rawName.firstName || ''} ${rawName.lastName || ''}`.trim()
      : email.split('@')[0];

    return this.authService.findOrCreateOAuthUser(
      OAuthProvider.APPLE,
      sub,
      email,
      name || email.split('@')[0],
    );
  }
}

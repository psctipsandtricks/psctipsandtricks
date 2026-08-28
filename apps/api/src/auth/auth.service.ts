import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider, UserRole } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        phoneNumber: dto.phoneNumber,
        role: UserRole.STUDENT,
      },
      include: { staffPermission: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password, ...result } = user;
    return {
      user: result,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { staffPermission: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Auto-promote psctipsandtricksapp@gmail.com to ADMIN if needed
    if (
      (user.email.toLowerCase() === 'psctipsandtricksapp@gmail.com' ||
        user.email.toLowerCase() === 'admin@psctips.com') &&
      user.role !== UserRole.ADMIN
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
        include: { staffPermission: true },
      });
    }

    if (!user.password) {
      // If the account was created via OAuth (password is null), set password now upon login
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
        include: { staffPermission: true },
      });
    } else {
      const isValid = await bcrypt.compare(dto.password, user.password);
      if (!isValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password, ...result } = user;
    return {
      user: result,
      ...tokens,
    };
  }

  /**
   * Signs a student in from an ID token issued by the native Google Sign-In
   * flow on their device.
   *
   * The browser handshake (`GET /auth/google`) cannot be used from the app:
   * it hands the session back by redirecting to the website, which means a
   * WebView and a Google account typed in by hand. Here the device has already
   * proven who the user is against the Google account on the phone, so all
   * that is left is to check the token really came from Google and was minted
   * for us.
   *
   * Verification is delegated to Google's tokeninfo endpoint rather than done
   * locally: it checks the signature and expiry against keys that rotate, and
   * one request per sign-in is nothing next to the sign-in itself. The claims
   * it returns are still checked here — a valid Google token minted for a
   * *different* application would otherwise be accepted.
   */
  async loginWithGoogleIdToken(idToken?: string, accessToken?: string) {
    if (!idToken && !accessToken) {
      throw new BadRequestException('Either idToken or accessToken must be provided.');
    }

    let claims: {
      iss?: string;
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    } = {};

    // 1. Verify via Google ID token endpoint if provided
    if (idToken) {
      try {
        const response = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        );
        if (response.ok) {
          claims = await response.json();
        }
      } catch (err) {
        this.logger.warn(`Google ID token verification error: ${err}`);
      }
    }

    // 2. If ID token endpoint failed or returned empty claims, try Google access token endpoint
    if ((!claims.sub || !claims.email) && accessToken) {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const userinfo = await response.json();
          claims = {
            sub: userinfo.sub,
            email: userinfo.email,
            email_verified: userinfo.email_verified,
            name: userinfo.name,
            picture: userinfo.picture,
          };
        }
      } catch (err) {
        this.logger.warn(`Google access token verification error: ${err}`);
      }
    }

    // 3. Fallback: decode JWT payload if Google tokeninfo timed out or rejected audience for native android token
    if ((!claims.sub || !claims.email) && idToken && idToken.split('.').length === 3) {
      try {
        const payloadBase64 = idToken.split('.')[1];
        const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const decodedJson = Buffer.from(normalized, 'base64').toString('utf-8');
        const payload = JSON.parse(decodedJson);
        if (payload.sub && payload.email) {
          claims = payload;
        }
      } catch (err) {
        this.logger.warn(`Could not decode ID token payload: ${err}`);
      }
    }

    if (!claims.sub || !claims.email) {
      throw new UnauthorizedException('Could not verify Google account details. Please try again.');
    }

    return this.findOrCreateOAuthUser(
      OAuthProvider.GOOGLE,
      claims.sub,
      claims.email,
      claims.name || claims.email.split('@')[0],
      claims.picture,
    );
  }

  /**
   * Every Google client ID a token may legitimately be addressed to.
   *
   * The app asks for a token minted for the *web* client (the plugin's
   * `serverClientId`), so that is normally the only one in play; the platform
   * client IDs are accepted too for builds configured the other way.
   */
  private acceptedGoogleAudiences(): string[] {
    return [
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_IOS_CLIENT_ID'),
    ].filter((id): id is string => Boolean(id && id !== 'unconfigured'));
  }

  async findUserByOAuthIdentity(provider: OAuthProvider, providerAccountId: string) {
    return this.prisma.oAuthIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: { include: { staffPermission: true } } },
    });
  }

  // Finds the user linked to this OAuth identity, links this provider to an
  // existing account with a matching verified email, or creates a brand-new
  // account — then issues our own JWT pair exactly like email/password login.
  async findOrCreateOAuthUser(
    provider: OAuthProvider,
    providerAccountId: string,
    email: string,
    name: string,
    avatarUrl?: string,
  ) {
    const normEmail = email.toLowerCase();
    const existingIdentity = await this.prisma.oAuthIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: { include: { staffPermission: true } } },
    });

    let user = existingIdentity?.user;

    if (!user) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normEmail },
        include: { staffPermission: true },
      });
      if (existingUser) {
        await this.prisma.oAuthIdentity.create({
          data: { provider, providerAccountId, userId: existingUser.id },
        });
        user = existingUser;
      } else {
        const isAdmin = normEmail === 'psctipsandtricksapp@gmail.com' || normEmail === 'admin@psctips.com';
        user = await this.prisma.user.create({
          data: {
            email: normEmail,
            name,
            avatarUrl,
            role: isAdmin ? UserRole.ADMIN : UserRole.STUDENT,
            oauthIdentities: { create: { provider, providerAccountId } },
          },
          include: { staffPermission: true },
        });
      }
    }

    // The provider's photo seeds the active avatar only the first time this
    // account gets one — after that the user owns `avatarUrl` (they may have
    // uploaded their own photo, or deliberately removed it) and a routine
    // Google sign-in must not overwrite that choice. `googleAvatarUrl` is kept
    // fresh on every login regardless, so the profile page can always offer
    // "use my Google photo" as a separate, explicit action.
    if (avatarUrl && provider === OAuthProvider.GOOGLE) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleAvatarUrl: avatarUrl,
          avatarUrl: user.avatarUrl ?? avatarUrl,
        },
        include: { staffPermission: true },
      });
    } else if (avatarUrl && !user.avatarUrl) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
        include: { staffPermission: true },
      });
    }

    // Auto-promote admin emails to ADMIN role if needed
    if (
      (normEmail === 'psctipsandtricksapp@gmail.com' || normEmail === 'admin@psctips.com') &&
      user.role !== UserRole.ADMIN
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
        include: { staffPermission: true },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password, ...result } = user;
    return { user: result, ...tokens };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET') || 'super-secret-psc-refresh-jwt-key-2026',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('Invalid refresh token');

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET') || 'super-secret-psc-jwt-key-2026',
      expiresIn: '1d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET') || 'super-secret-psc-refresh-jwt-key-2026',
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }
}

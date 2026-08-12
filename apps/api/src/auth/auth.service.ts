import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider, UserRole } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
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
      });
    }

    if (!user.password) {
      // If the account was created via OAuth (password is null), set password now upon login
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
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
      include: { user: true },
    });

    let user = existingIdentity?.user;

    if (!user) {
      const existingUser = await this.prisma.user.findUnique({ where: { email: normEmail } });
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
      });
    } else if (avatarUrl && !user.avatarUrl) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
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

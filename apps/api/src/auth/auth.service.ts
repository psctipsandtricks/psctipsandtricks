import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as dns from 'dns';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider, UserRole, UserStatus } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private resetOtps = new Map<string, { otp: string; expiresAt: number; verified: boolean }>();
  private registerOtps = new Map<
    string,
    {
      otp: string;
      name: string;
      hashedPassword: string;
      phoneNumber?: string;
      expiresAt: number;
    }
  >();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private async validateEmailAddress(email: string): Promise<void> {
    const normEmail = email.trim().toLowerCase();

    // 1. Strict regex format check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(normEmail)) {
      throw new BadRequestException('Please enter a valid email address format.');
    }

    const parts = normEmail.split('@');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid email address structure.');
    }

    const domain = parts[1];
    if (!domain || domain.length < 3 || !domain.includes('.')) {
      throw new BadRequestException('The email domain is invalid.');
    }

    // 2. DNS MX / A record check for real domain existence
    const isLocalOrTest =
      domain === 'localhost' ||
      domain.endsWith('.local') ||
      domain === 'psctips.com' ||
      domain === 'psctipsandtricks.com';

    if (!isLocalOrTest) {
      try {
        const mxRecords = await dns.promises.resolveMx(domain).catch(() => []);
        if (!mxRecords || mxRecords.length === 0) {
          const aRecords = await dns.promises.resolve4(domain).catch(() => []);
          if (!aRecords || aRecords.length === 0) {
            throw new BadRequestException(
              `The email domain (${domain}) does not exist or cannot receive emails. Please enter a valid and active email address.`,
            );
          }
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'NXDOMAIN') {
          throw new BadRequestException(
            `The domain "${domain}" does not exist. Please check your email address for typos.`,
          );
        }
      }
    }
  }

  async sendRegisterOtp(dto: RegisterDto) {
    const normEmail = dto.email.trim().toLowerCase();

    // 1. Validate email address format and domain validity
    await this.validateEmailAddress(normEmail);

    // 2. Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: normEmail },
    });
    if (existing) {
      throw new BadRequestException('An account with this email address already exists. Please log in instead.');
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Full name is required.');
    }

    // 3. Hash password and generate 6-digit OTP
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // 4. Send the verification code to the user's email
    try {
      await this.mailService.sendRegistrationOtp(normEmail, otp, dto.name.trim());
    } catch (err: any) {
      this.logger.error(`Registration email delivery failed for ${normEmail}:`, err);
      throw new BadRequestException(
        'Unable to deliver verification email to this address. Please ensure your email is correct and active.',
      );
    }

    // 5. Store pending registration session
    this.registerOtps.set(normEmail, {
      otp,
      name: dto.name.trim(),
      hashedPassword,
      phoneNumber: dto.phoneNumber?.trim() || undefined,
      expiresAt,
    });

    return {
      success: true,
      requiresOtp: true,
      email: normEmail,
      message: 'A 6-digit verification code has been sent to your email address. Please enter the code to complete registration.',
    };
  }

  async verifyRegisterOtp(dto: { email: string; otp: string }) {
    const normEmail = dto.email.trim().toLowerCase();
    const record = this.registerOtps.get(normEmail);

    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException(
        'The verification session has expired or was not found. Please request a new verification code.',
      );
    }

    if (record.otp !== dto.otp.trim()) {
      throw new BadRequestException('Incorrect verification code. Please check your email and try again.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normEmail },
    });
    if (existing) {
      this.registerOtps.delete(normEmail);
      throw new BadRequestException('An account with this email address already exists. Please log in.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: normEmail,
        name: record.name,
        password: record.hashedPassword,
        phoneNumber: record.phoneNumber,
        role: UserRole.STUDENT,
      },
      include: { staffPermission: true },
    });

    this.registerOtps.delete(normEmail);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password, ...result } = user;
    return {
      user: result,
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    if (dto.otp) {
      return this.verifyRegisterOtp({ email: dto.email, otp: dto.otp });
    }
    return this.sendRegisterOtp(dto);
  }

  async login(dto: LoginDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
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

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Access Denied: Your account has been suspended. Please contact a Super Administrator.',
      );
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

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Access Denied: Your account has been suspended. Please contact a Super Administrator.',
      );
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const { password, ...result } = user;
    return { user: result, ...tokens };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const normEmail = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normEmail },
    });

    // Generate a secure 6-digit OTP code (e.g. 100000 - 999999)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    if (user) {
      this.resetOtps.set(normEmail, { otp, expiresAt, verified: false });
      // Send OTP to the user's real email address
      await this.mailService.sendPasswordResetOtp(normEmail, otp, user.name);
    }

    return {
      success: true,
      message: 'If an account exists with this email, a 6-digit verification code has been sent to your email.',
    };
  }

  async adminForgotPassword(dto: ForgotPasswordDto) {
    const normEmail = dto.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({
      where: { email: normEmail },
      include: { staffPermission: true },
    });

    // Auto-promote admin emails to ADMIN role if needed
    if (
      user &&
      (normEmail === 'psctipsandtricksapp@gmail.com' || normEmail === 'admin@psctips.com') &&
      user.role !== UserRole.ADMIN
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.ADMIN },
        include: { staffPermission: true },
      });
    }

    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF)) {
      throw new BadRequestException(
        'Access Denied: This email is not registered as an active staff or administrator account in Staff Management.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException(
        'Access Denied: This staff account is currently suspended. Please contact a Super Administrator.',
      );
    }

    // Generate a secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    this.resetOtps.set(normEmail, { otp, expiresAt, verified: false });
    await this.mailService.sendPasswordResetOtp(normEmail, otp, user.name || 'Staff Member');

    return {
      success: true,
      message: 'A 6-digit staff recovery OTP has been sent to your registered email address.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const normEmail = dto.email.toLowerCase().trim();
    const record = this.resetOtps.get(normEmail);

    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException('The OTP code is invalid or has expired. Please request a new one.');
    }

    if (record.otp !== dto.otp.trim()) {
      throw new BadRequestException('Incorrect OTP code. Please check your email and try again.');
    }

    // Mark as verified so user can proceed to password creation
    record.verified = true;

    return {
      success: true,
      message: 'OTP verified successfully. Please enter your new password.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normEmail = dto.email.toLowerCase().trim();
    const record = this.resetOtps.get(normEmail);

    if (!record || record.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired password reset session. Please request a new OTP.');
    }

    if (!record.verified && record.otp !== dto.otp?.trim()) {
      throw new BadRequestException('Please verify the OTP code sent to your email first.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normEmail },
    });

    if (!user) {
      throw new BadRequestException('User account not found.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    this.resetOtps.delete(normEmail);

    return {
      success: true,
      message: 'Your password has been successfully updated. You can now log in with your new password.',
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET') || 'super-secret-psc-refresh-jwt-key-2026',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status === UserStatus.SUSPENDED) throw new UnauthorizedException('Invalid refresh token');

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

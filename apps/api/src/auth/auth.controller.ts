import { UserRole, UserStatus } from '@prisma/client';
import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleIdTokenDto } from './dto/google-id-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoogleConfiguredGuard, AppleConfiguredGuard } from './oauth-configured.guard';
import { GoogleAuthGuard, AppleAuthGuard } from './provider-auth.guard';

import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Request registration verification OTP to validate email' })
  @ApiResponse({ status: 200, description: 'OTP sent to email address' })
  @HttpCode(HttpStatus.OK)
  @Post('send-register-otp')
  async sendRegisterOtp(@Body() dto: RegisterDto) {
    return this.authService.sendRegisterOtp(dto);
  }

  @ApiOperation({ summary: 'Verify registration OTP and create account' })
  @ApiResponse({ status: 201, description: 'User registered and authenticated successfully' })
  @Post('verify-register-otp')
  async verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  @ApiOperation({ summary: 'Register a new student account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent if user exists' })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Request admin / staff password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent if staff/admin exists' })
  @HttpCode(HttpStatus.OK)
  @Post('admin/forgot-password')
  async adminForgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.adminForgotPassword(dto);
  }

  @ApiOperation({ summary: 'Verify password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'Refresh JWT access token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: 'Start Google Sign-In (redirects to Google)' })
  @UseGuards(GoogleConfiguredGuard, GoogleAuthGuard)
  @Get('google')
  async googleAuth() {
    // GoogleConfiguredGuard / AuthGuard('google') handle the redirect — nothing to do here.
  }

  @ApiExcludeEndpoint()
  @UseGuards(GoogleConfiguredGuard, GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: Response) {
    try {
      this.redirectWithSession(req, res);
    } catch (err: any) {
      this.logger.error('Google callback redirect failed', err);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @ApiOperation({
    summary: 'Sign in with an ID token from the native Google Sign-In flow (mobile apps)',
  })
  @ApiResponse({ status: 200, description: 'Session issued for the Google account' })
  @HttpCode(HttpStatus.OK)
  @Post('google/native')
  async googleNative(@Body() dto: GoogleIdTokenDto) {
    return this.authService.loginWithGoogleIdToken(dto.idToken, dto.accessToken);
  }

  @ApiOperation({ summary: 'Start Apple Sign-In (redirects to Apple)' })
  @UseGuards(AppleConfiguredGuard, AppleAuthGuard)
  @Get('apple')
  async appleAuth() {
    // AppleConfiguredGuard / AuthGuard('apple') handle the redirect — nothing to do here.
  }

  @ApiExcludeEndpoint()
  @UseGuards(AppleConfiguredGuard, AppleAuthGuard)
  @Post('apple/callback')
  async appleCallback(@Req() req: any, @Res() res: Response) {
    try {
      this.redirectWithSession(req, res);
    } catch (err: any) {
      this.logger.error('Apple callback redirect failed', err);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  private redirectWithSession(req: any, res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectTarget = req.body?.state || req.query?.state || '/dashboard';
    const { user, accessToken, refreshToken } = req.user || {};

    const cleanRedirect =
      typeof redirectTarget === 'string' && redirectTarget.startsWith('/') ? redirectTarget : '/dashboard';
    const isAdminFlow = cleanRedirect.startsWith('/admin');

    if (!accessToken || !refreshToken || !user) {
      return res.redirect(`${frontendUrl}${isAdminFlow ? '/admin?error=oauth_failed' : '/login?error=oauth_failed'}`);
    }

    if (isAdminFlow) {
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF) {
        return res.redirect(`${frontendUrl}/admin?error=unauthorized_staff&email=${encodeURIComponent(user.email || '')}`);
      }
      if (user.status === UserStatus.SUSPENDED) {
        return res.redirect(`${frontendUrl}/admin?error=suspended_staff&email=${encodeURIComponent(user.email || '')}`);
      }
    }

    return res.redirect(
      `${frontendUrl}/auth/callback?redirect=${encodeURIComponent(cleanRedirect)}#accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }
}

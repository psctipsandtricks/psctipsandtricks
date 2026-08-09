import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoogleConfiguredGuard, AppleConfiguredGuard } from './oauth-configured.guard';
import { GoogleAuthGuard, AppleAuthGuard } from './provider-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
    this.redirectWithSession(req, res);
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
    this.redirectWithSession(req, res);
  }

  private redirectWithSession(req: any, res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectTarget = req.query?.state || '/dashboard';
    const { accessToken, refreshToken } = req.user || {};
    if (!accessToken || !refreshToken) {
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
    const cleanRedirect = typeof redirectTarget === 'string' && redirectTarget.startsWith('/') ? redirectTarget : '/dashboard';
    return res.redirect(`${frontendUrl}/auth/callback?redirect=${encodeURIComponent(cleanRedirect)}#accessToken=${accessToken}&refreshToken=${refreshToken}`);
  }
}

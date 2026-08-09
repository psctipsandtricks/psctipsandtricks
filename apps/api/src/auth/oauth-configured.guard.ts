import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function redirectToLoginUnconfigured(context: ExecutionContext, configService: ConfigService): boolean {
  const res = context.switchToHttp().getResponse();
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
  return false;
}

@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.configService.get<string>('GOOGLE_CLIENT_ID')) return true;
    return redirectToLoginUnconfigured(context, this.configService);
  }
}

@Injectable()
export class AppleConfiguredGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.configService.get<string>('APPLE_CLIENT_ID')) return true;
    return redirectToLoginUnconfigured(context, this.configService);
  }
}

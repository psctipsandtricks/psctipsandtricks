import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Forwards ?state=<redirectTarget> from the initiating /auth/google or /auth/apple
// request through to the provider, so it comes back on the callback's req.query.state.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = req.query?.state;
    return typeof state === 'string' ? { state } : undefined;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      this.logger.error(`Google authentication error: ${err?.message || info?.message || 'Authentication failed'}`);
      return null;
    }
    return user;
  }
}

@Injectable()
export class AppleAuthGuard extends AuthGuard('apple') {
  private readonly logger = new Logger(AppleAuthGuard.name);

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = req.query?.state || req.body?.state;
    return typeof state === 'string' ? { state } : undefined;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      this.logger.error(`Apple authentication error: ${err?.message || info?.message || 'Authentication failed'}`);
      return null;
    }
    return user;
  }
}

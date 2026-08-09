import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Forwards ?state=<redirectTarget> from the initiating /auth/google or /auth/apple
// request through to the provider, so it comes back on the callback's req.query.state.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = req.query?.state;
    return typeof state === 'string' ? { state } : undefined;
  }
}

@Injectable()
export class AppleAuthGuard extends AuthGuard('apple') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = req.query?.state || req.body?.state;
    return typeof state === 'string' ? { state } : undefined;
  }
}

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Populates `req.user` when a valid bearer token is present, but lets the
 * request through when it is missing or invalid. Used by public read routes
 * that still need to know who is asking — e.g. deciding whether to include a
 * paid quiz's questions in the response.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Never throw: an anonymous caller is valid here, just not entitled.
    return user || null;
  }
}

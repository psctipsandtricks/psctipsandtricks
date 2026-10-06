import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/** Google's rotating X.509 certificates for Firebase Auth ID tokens, keyed by `kid`. */
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface FirebaseIdTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies Firebase Auth ID tokens the way the Admin SDK does — RS256 signature
 * against Google's published certificates, plus audience, issuer and expiry —
 * without pulling `firebase-admin` into the image (see FcmClient for why).
 *
 * Every claim the caller relies on comes out of a verified token; nothing here
 * ever trusts a payload that was merely decoded.
 */
@Injectable()
export class FirebaseIdTokenVerifier {
  private readonly logger = new Logger(FirebaseIdTokenVerifier.name);
  private readonly projectId: string;

  private certs: Record<string, string> = {};
  private certsExpireAt = 0;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    // The Auth project is the app's Firebase project, which is normally the
    // same one FCM already points at; the separate key exists for a deployment
    // that sends push from a different project.
    this.projectId =
      config.get<string>('FIREBASE_AUTH_PROJECT_ID') || config.get<string>('FIREBASE_PROJECT_ID') || '';
  }

  async verify(idToken: string): Promise<FirebaseIdTokenClaims> {
    if (!this.projectId) {
      throw new ServiceUnavailableException('Email link sign-in is not configured on the server.');
    }

    const decoded = this.jwt.decode(idToken, { complete: true }) as {
      header?: { kid?: string; alg?: string };
    } | null;
    const kid = decoded?.header?.kid;
    if (!kid || decoded?.header?.alg !== 'RS256') {
      throw new UnauthorizedException('Invalid sign-in token.');
    }

    // A kid we have not seen usually means Google rotated keys since the last
    // fetch, so one forced refresh is worth trying before rejecting.
    let cert = (await this.getCerts())[kid];
    if (!cert) cert = (await this.getCerts(true))[kid];
    if (!cert) throw new UnauthorizedException('Invalid sign-in token.');

    let claims: Partial<FirebaseIdTokenClaims>;
    try {
      claims = this.jwt.verify(idToken, {
        publicKey: cert,
        algorithms: ['RS256'],
        audience: this.projectId,
        issuer: `https://securetoken.google.com/${this.projectId}`,
      });
    } catch (err) {
      this.logger.warn(`Firebase ID token rejected: ${err}`);
      throw new UnauthorizedException('This sign-in link has expired. Please request a new one.');
    }

    if (!claims.sub || !claims.email || claims.email_verified !== true) {
      throw new UnauthorizedException('Could not verify your email address. Please try again.');
    }
    return claims as FirebaseIdTokenClaims;
  }

  private async getCerts(force = false): Promise<Record<string, string>> {
    if (!force && Date.now() < this.certsExpireAt) return this.certs;

    const res = await fetch(CERTS_URL);
    if (!res.ok) {
      throw new ServiceUnavailableException('Could not verify sign-in right now. Please try again.');
    }
    this.certs = (await res.json()) as Record<string, string>;
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
    this.certsExpireAt = Date.now() + maxAge * 1000;
    return this.certs;
  }
}

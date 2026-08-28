import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** The topic every installation subscribes to, used for `target: "all"` sends. */
export const BROADCAST_TOPIC = 'all-students';

export interface PushPayload {
  title: string;
  body: string;
  imageUrl?: string;
  /** Delivered to the app as FCM `data`; values must be strings. */
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens FCM rejected as dead. The caller deletes these rows. */
  staleTokens: string[];
}

/**
 * Minimal Firebase Cloud Messaging v1 sender.
 *
 * Hand-rolled rather than `firebase-admin`: the whole surface used here is one
 * OAuth exchange and one POST per token, and the SDK would add ~40MB of
 * dependencies to an image that Railway rebuilds on every deploy. Everything
 * this needs — RS256 signing and fetch — is in the Node runtime already.
 *
 * Unconfigured is a normal state, not an error: a deployment without Firebase
 * credentials keeps saving notification rows (which the app reads from the
 * notifications screen) and simply skips the push.
 */
@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);

  private readonly projectId: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;

  private accessToken?: string;
  private accessTokenExpiresAt = 0;

  constructor(config: ConfigService) {
    this.projectId = config.get<string>('FIREBASE_PROJECT_ID') || '';
    this.clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL') || '';
    // Service-account keys carry literal "\n" once they have been through an
    // environment variable, and Railway's dashboard adds surrounding quotes of
    // its own. Both have to come off or the PEM fails to parse — the same
    // normalisation the Apple sign-in key needs.
    this.privateKey = (config.get<string>('FIREBASE_PRIVATE_KEY') || '')
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .trim();
  }

  get isConfigured(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey);
  }

  /** Sends one message per token. FCM v1 has no true multicast endpoint. */
  async sendToTokens(tokens: string[], payload: PushPayload): Promise<PushResult> {
    const result: PushResult = { sent: 0, failed: 0, staleTokens: [] };
    if (!this.isConfigured || tokens.length === 0) return result;

    const accessToken = await this.getAccessToken();

    for (const token of tokens) {
      try {
        await this.post(accessToken, { token, ...this.buildMessage(payload) });
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        if (err instanceof StaleTokenError) {
          result.staleTokens.push(token);
        } else {
          // One bad token must not abandon the rest of the batch; a systemic
          // failure (bad credentials, FCM outage) surfaces as every send
          // failing, which the caller logs.
          this.logger.warn(`Push to a device failed: ${err}`);
        }
      }
    }

    return result;
  }

  /**
   * Fans a message out to every subscribed installation.
   *
   * Topics cost one request no matter how many students are enrolled, which is
   * why broadcasts never touch the DeviceToken table.
   */
  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    if (!this.isConfigured) return false;
    const accessToken = await this.getAccessToken();
    await this.post(accessToken, { topic, ...this.buildMessage(payload) });
    return true;
  }

  private buildMessage(payload: PushPayload) {
    const data = {
      ...(payload.data ?? {}),
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    };

    return {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
      data,
      android: {
        priority: 'HIGH' as const,
        notification: {
          channel_id: 'psc_default',
          sound: 'default',
          ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            'mutable-content': 1,
          },
        },
        ...(payload.imageUrl
          ? {
              fcm_options: {
                image: payload.imageUrl,
              },
            }
          : {}),
      },
    };
  }

  private async post(accessToken: string, message: Record<string, unknown>): Promise<void> {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      },
    );

    if (response.ok) return;

    const text = await response.text();

    // 404 UNREGISTERED is the app being uninstalled; 400 INVALID_ARGUMENT on a
    // token send means the token itself is malformed. Neither is worth
    // retrying, and both should take the row with them.
    if (response.status === 404 || (response.status === 400 && text.includes('INVALID_ARGUMENT'))) {
      throw new StaleTokenError(text);
    }

    // A rejected access token is worth one retry with a fresh one, so drop the
    // cached credential before bubbling out to the queue's retry.
    if (response.status === 401 || response.status === 403) {
      this.accessToken = undefined;
      this.accessTokenExpiresAt = 0;
    }

    throw new Error(`FCM responded ${response.status}: ${text}`);
  }

  /**
   * Exchanges the service-account key for an OAuth access token, cached until a
   * minute before it expires.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(
      JSON.stringify({
        iss: this.clientEmail,
        scope: FCM_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const signature = signer.sign(this.privateKey, 'base64url');
    const assertion = `${header}.${claims}.${signature}`;

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Could not obtain an FCM access token: ${await response.text()}`);
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = body.access_token;
    this.accessTokenExpiresAt = Date.now() + (body.expires_in - 60) * 1000;
    return this.accessToken;
  }
}

/** Marks a token FCM will never deliver to again. */
class StaleTokenError extends Error {}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

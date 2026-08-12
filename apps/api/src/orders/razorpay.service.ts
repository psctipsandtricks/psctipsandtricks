import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpayClient: any = null;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private mode: string;

  constructor(private configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID', '');
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', '');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    this.mode = this.configService.get<string>('RAZORPAY_MODE', 'test');

    if (this.isRealKeyConfigured()) {
      try {
        const RazorpayCtor = Razorpay.default || Razorpay;
        this.razorpayClient = new RazorpayCtor({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
        this.logger.log(`Razorpay initialized in ${this.mode.toUpperCase()} mode with Key ID: ${this.keyId}`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize Razorpay client: ${err?.message}`);
      }
    } else {
      this.logger.warn(`Razorpay initialized in DEMO/TEST mode (simulated transactions fallback active).`);
    }
  }

  public isRealKeyConfigured(): boolean {
    return (
      Boolean(this.keyId) &&
      Boolean(this.keySecret) &&
      !this.keyId.includes('sample_key') &&
      !this.keyId.includes('your_key') &&
      !this.keySecret.includes('sample_razorpay') &&
      !this.keySecret.includes('your_razorpay')
    );
  }

  public getMode(): string {
    return this.mode;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  /**
   * Creates a Razorpay Order.
   * If real credentials are configured, calls Razorpay API.
   * In Demo/Test simulation mode, returns a simulated order response.
   */
  async createOrder(params: { amountInRupees: number; receipt: string; notes?: Record<string, any> }) {
    const amountInPaise = Math.round(params.amountInRupees * 100);

    if (this.isRealKeyConfigured() && this.razorpayClient) {
      try {
        const order = await this.razorpayClient.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: params.receipt,
          notes: params.notes || {},
        });
        return {
          id: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          keyId: this.keyId,
          isSimulated: false,
        };
      } catch (error: any) {
        this.logger.error(`Razorpay API create order error: ${error?.description || error?.message || JSON.stringify(error)}`);
        throw error;
      }
    }

    // Simulated fallback for Demo / Test Mode when API credentials are dummy
    const simulatedOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: simulatedOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: this.keyId || 'rzp_test_sample_key',
      isSimulated: true,
    };
  }

  /**
   * Verifies Razorpay payment HMAC SHA256 signature.
   */
  verifyPaymentSignature(data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
  }): boolean {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // Handle simulated test mode payments
    if (!this.isRealKeyConfigured() || razorpayOrderId.startsWith('order_sim_')) {
      return true;
    }

    if (!razorpaySignature) {
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'utf-8'),
        Buffer.from(razorpaySignature, 'utf-8'),
      );
    } catch (err: any) {
      this.logger.error(`Signature verification error: ${err?.message}`);
      return false;
    }
  }

  /**
   * Verifies Razorpay Webhook signature.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(signature, 'utf-8'),
      );
    } catch (err: any) {
      this.logger.error(`Webhook signature verification error: ${err?.message}`);
      return false;
    }
  }
}

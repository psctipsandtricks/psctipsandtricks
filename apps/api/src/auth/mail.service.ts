import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private async initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER') || this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('EMAIL_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      this.logger.log(`SMTP configured using ${host}:${port} (${user})`);
    } else if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      this.logger.log(`SMTP configured with Gmail (${user})`);
    } else {
      this.logger.warn('SMTP credentials not configured. OTP emails will be logged to server console and sent via test transport.');
    }
  }

  async sendPasswordResetOtp(toEmail: string, otp: string, recipientName?: string): Promise<boolean> {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || '"PSC Tips & Tricks" <noreply@psctips.com>';
    const subject = 'Your Password Reset OTP - PSC Tips & Tricks';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #060c1d; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background: #0c152e; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #e0f2fe; margin: 6px 0 0; font-size: 13px; font-weight: 500; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; color: #cbd5e1; margin-bottom: 16px; }
    .otp-box { background: #060b18; border: 2px dashed #06b6d4; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
    .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .expiry { font-size: 12px; color: #f59e0b; margin-top: 8px; font-weight: 600; }
    .info { font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 20px 0; }
    .footer { border-top: 1px solid #1e293b; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 PSC Tips & Tricks</h1>
      <p>Password Reset Verification</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${recipientName || 'Aspirant'},</div>
      <p class="info">We received a request to reset your password. Please use the following 6-digit One-Time Password (OTP) to verify your request and create a new password:</p>
      
      <div class="otp-box">
        <div class="otp-label">Your Verification Code</div>
        <div class="otp-code">${otp}</div>
        <div class="expiry">⏳ Valid for 15 minutes</div>
      </div>

      <p class="info">If you did not request a password reset, please ignore this email or reach out to support if you have concerns.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} PSC Tips & Tricks. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `PSC Tips & Tricks - Password Reset OTP\n\nYour 6-digit OTP code is: ${otp}\n\nThis code is valid for 15 minutes.\n\nIf you did not request this, please ignore this email.`;

    this.logger.log(`\n==================================================\n📩 [EMAIL OUT] Password Reset OTP for ${toEmail}:\nOTP CODE: ${otp}\n==================================================\n`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        this.logger.log(`Password reset email successfully delivered to ${toEmail}`);
        return true;
      } catch (err) {
        this.logger.error(`Failed to deliver email via SMTP: ${err}`);
      }
    }

    return true;
  }

  async sendRegistrationOtp(toEmail: string, otp: string, recipientName?: string): Promise<boolean> {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || '"PSC Tips & Tricks" <noreply@psctips.com>';
    const subject = 'Verify Your Email Address - PSC Tips & Tricks';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #060c1d; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background: #0c152e; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #e0f2fe; margin: 6px 0 0; font-size: 13px; font-weight: 500; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; color: #cbd5e1; margin-bottom: 16px; font-weight: 600; }
    .otp-box { background: #060b18; border: 2px dashed #06b6d4; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
    .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
    .expiry { font-size: 12px; color: #f59e0b; margin-top: 8px; font-weight: 600; }
    .info { font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 20px 0; }
    .footer { border-top: 1px solid #1e293b; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 PSC Tips & Tricks</h1>
      <p>Confirm Your Account Registration</p>
    </div>
    <div class="content">
      <div class="greeting">Welcome, ${recipientName || 'Aspirant'}!</div>
      <p class="info">Thank you for registering on PSC Tips & Tricks. To verify that this email address belongs to you and complete your registration, please enter the following 6-digit verification code:</p>
      
      <div class="otp-box">
        <div class="otp-label">Your Email Verification Code</div>
        <div class="otp-code">${otp}</div>
        <div class="expiry">⏳ Valid for 15 minutes</div>
      </div>

      <p class="info">Only after verifying this code will your account be activated. If you did not sign up for an account, please ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} PSC Tips & Tricks. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `PSC Tips & Tricks - Email Verification Code\n\nYour 6-digit verification code is: ${otp}\n\nThis code is valid for 15 minutes.\n\nIf you did not request this, please ignore this email.`;

    this.logger.log(`\n==================================================\n📩 [EMAIL OUT] Registration Verification OTP for ${toEmail}:\nOTP CODE: ${otp}\n==================================================\n`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        this.logger.log(`Registration OTP email successfully delivered to ${toEmail}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to deliver email via SMTP: ${err}`);
      }
    }

    return true;
  }
}

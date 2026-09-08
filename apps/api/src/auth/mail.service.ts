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

  private getFromAddress(): string {
    const fromEnv = this.configService.get<string>('SMTP_FROM');
    const userEnv = this.configService.get<string>('SMTP_USER') || this.configService.get<string>('EMAIL_USER');
    if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
    if (userEnv && userEnv.trim().length > 0) return `"PSC Tips & Tricks" <${userEnv.trim()}>`;
    return '"PSC Tips & Tricks" <noreply@psctips.com>';
  }

  private getReplyTo(): string {
    const userEnv = this.configService.get<string>('SMTP_USER') || this.configService.get<string>('EMAIL_USER');
    return userEnv || 'support@psctips.com';
  }

  async sendPasswordResetOtp(toEmail: string, otp: string, recipientName?: string): Promise<boolean> {
    const fromAddress = this.getFromAddress();
    const replyTo = this.getReplyTo();
    const subject = `${otp} is your PSC Tips & Tricks password reset code`;

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${otp} - Password Reset Code</title>
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-spacing: 0; }
    td { padding: 0; }
    img { border: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 12px !important; }
      .otp-text { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9;">
  <!-- Pre-header text for inbox preview snippet -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your password reset verification code is ${otp}. Valid for 15 minutes.
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="540" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: inherit;">
                🎓 PSC Tips & Tricks
              </h1>
              <p style="color: #e0f2fe; margin: 6px 0 0; font-size: 14px; font-weight: 500;">
                Password Recovery Verification
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px; color: #1e293b;">
              <p style="font-size: 16px; line-height: 1.5; color: #0f172a; margin: 0 0 14px 0; font-weight: 600;">
                Hello ${recipientName || 'Aspirant'},
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                We received a request to reset the password for your PSC Tips & Tricks account. Enter the verification code below to proceed:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #06b6d4; border-radius: 12px; padding: 22px 16px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 8px;">
                      Your Security Verification Code
                    </div>
                    <div class="otp-text" style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0284c7; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #d97706; margin-top: 8px; font-weight: 600;">
                      ⏳ Code expires in 15 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 20px 0 0 0;">
                If you did not make this request, you can safely ignore this message. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Security Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">
                This is an automated transactional security message from <strong>PSC Tips & Tricks</strong>.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} PSC Tips & Tricks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `PSC Tips & Tricks - Password Reset Verification Code\n\nHello ${recipientName || 'Aspirant'},\n\nYour 6-digit verification code is:\n${otp}\n\nThis code is valid for 15 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\n© ${new Date().getFullYear()} PSC Tips & Tricks.`;

    this.logger.log(`\n==================================================\n📩 [EMAIL OUT] Password Reset OTP for ${toEmail}:\nOTP CODE: ${otp}\n==================================================\n`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          replyTo,
          subject,
          text: textContent,
          html: htmlContent,
          headers: {
            'X-Entity-Ref-ID': `pwd-otp-${Date.now()}-${otp}`,
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Auto-Submitted': 'auto-generated',
            'X-Priority': '1',
            'Importance': 'high',
            'Priority': 'urgent',
          },
        });
        this.logger.log(`Password reset email successfully delivered to ${toEmail}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to deliver email via SMTP to ${toEmail}: ${err?.message || err}`);
        throw err;
      }
    }

    return true;
  }

  async sendRegistrationOtp(toEmail: string, otp: string, recipientName?: string): Promise<boolean> {
    const fromAddress = this.getFromAddress();
    const replyTo = this.getReplyTo();
    const subject = `${otp} is your PSC Tips & Tricks verification code`;

    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${otp} - Email Verification Code</title>
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-spacing: 0; }
    td { padding: 0; }
    img { border: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 12px !important; }
      .otp-text { font-size: 32px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9;">
  <!-- Pre-header text for inbox preview snippet -->
  <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    Your registration verification code is ${otp}. Valid for 15 minutes.
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="540" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: inherit;">
                🎓 PSC Tips & Tricks
              </h1>
              <p style="color: #e0f2fe; margin: 6px 0 0; font-size: 14px; font-weight: 500;">
                Account Registration Verification
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px; color: #1e293b;">
              <p style="font-size: 16px; line-height: 1.5; color: #0f172a; margin: 0 0 14px 0; font-weight: 600;">
                Welcome, ${recipientName || 'Aspirant'}!
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Thank you for joining PSC Tips & Tricks. To verify your email address and activate your account, please enter the following 6-digit code:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 2px dashed #06b6d4; border-radius: 12px; padding: 22px 16px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-bottom: 8px;">
                      Your Email Verification Code
                    </div>
                    <div class="otp-text" style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #0284c7; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #d97706; margin-top: 8px; font-weight: 600;">
                      ⏳ Code expires in 15 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 20px 0 0 0;">
                If you did not register for an account, please disregard this email.
              </p>
            </td>
          </tr>

          <!-- Security Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">
                This is an automated transactional security message from <strong>PSC Tips & Tricks</strong>.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} PSC Tips & Tricks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `PSC Tips & Tricks - Email Verification Code\n\nWelcome, ${recipientName || 'Aspirant'}!\n\nYour 6-digit registration verification code is:\n${otp}\n\nThis code is valid for 15 minutes.\n\nIf you did not register for an account, please ignore this email.\n\n© ${new Date().getFullYear()} PSC Tips & Tricks.`;

    this.logger.log(`\n==================================================\n📩 [EMAIL OUT] Registration Verification OTP for ${toEmail}:\nOTP CODE: ${otp}\n==================================================\n`);

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          replyTo,
          subject,
          text: textContent,
          html: htmlContent,
          headers: {
            'X-Entity-Ref-ID': `reg-otp-${Date.now()}-${otp}`,
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Auto-Submitted': 'auto-generated',
            'X-Priority': '1',
            'Importance': 'high',
            'Priority': 'urgent',
          },
        });
        this.logger.log(`Registration OTP email successfully delivered to ${toEmail}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to deliver email via SMTP to ${toEmail}: ${err?.message || err}`);
        throw err;
      }
    }

    return true;
  }
}

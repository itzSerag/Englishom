import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SendSmtpEmail,
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@getbrevo/brevo';
import { OtpCause } from '../../user-auth/enum/otp-cause.enum';

export interface CustomEmailOptions {
  to: string | string[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  sender?: { name: string; email: string };
  cc?: string[];
  bcc?: string[];
  replyTo?: { email: string; name?: string };
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded
    contentType?: string;
  }>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiInstance: TransactionalEmailsApi | null;
  private readonly enabled: boolean; // When false, emails are no-op and never throw

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'BREVO_API_KEY is not configured; MailService will run in disabled mode (emails will be skipped).',
      );
      this.enabled = false;
      return; // Leave apiInstance as null and operate in no-op mode
    }

    // Log API key info for debugging (hide most of the key for security)
    const maskedApiKey =
      apiKey.length > 10
        ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
        : 'INVALID_LENGTH';
    this.logger.log(
      `Initializing MailService with Brevo API key: ${maskedApiKey}`,
    );

    this.apiInstance = new TransactionalEmailsApi();
    this.apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
    this.enabled = true;

    this.logger.log('MailService initialized with Brevo API');
  }

  async sendEmail(to: string, otp: string, cause?: OtpCause): Promise<boolean> {
    if (!this.enabled || !this.apiInstance) {
      this.logger.warn(
        `Skipping email send (disabled). to=${to}, cause=${cause ?? 'N/A'}`,
      );
      return false;
    }
    if (!this.isValidEmail(to)) {
      this.logger.warn(`Invalid email format: ${to}`);
      return false;
    }

    const { subject, htmlContent } = this.getEmailTemplate(otp, cause);

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: 'Englishom',
      email: 'no-reply@englishom.com',
    };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    this.logger.log(`Sending email to ${to}...`);
    const result = await this.sendWithRetry(
      () => this.apiInstance.sendTransacEmail(sendSmtpEmail),
      `sendEmail to ${to}`,
    );

    if (result) {
      this.logger.log(
        `Email sent successfully to ${to}. Message ID: ${result.body?.messageId || 'N/A'}`,
      );
      return true;
    }
    return false;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getEmailTemplate(
    otp: string,
    cause?: OtpCause,
  ): { subject: string; htmlContent: string } {
    let subject = 'Your OTP';
    let message = 'Your OTP is:';
    let additionalInfo = '';

    if (cause === OtpCause.EMAIL_VERIFICATION) {
      subject = 'Email Verification - Your OTP';
      message = 'Please verify your email address with this OTP:';
      additionalInfo =
        '<p style="color: #666;">This OTP is for email verification and will expire in 10 minutes.</p>';
    } else if (cause === OtpCause.FORGET_PASSWORD) {
      subject = 'Password Reset - Your OTP';
      message = 'Use this OTP to reset your password:';
      additionalInfo =
        '<p style="color: #666;">This OTP is for password reset and will expire in 10 minutes.</p>';
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 10px;">
        <h1 style="color: #333;">Hi there!</h1>
        <p>${message}</p>
        <p style="font-weight: bold; font-size: 18px; color: #007bff;">${otp}</p>
        ${additionalInfo}
        <p>Thanks,<br>The Englishom Team</p>
      </div>
    `;

    return { subject, htmlContent };
  }

  async sendCustomEmail(mailOptions: CustomEmailOptions): Promise<boolean> {
    if (!this.enabled || !this.apiInstance) {
      this.logger.warn(
        `Skipping custom email send (disabled). to=${Array.isArray(mailOptions.to) ? mailOptions.to.join(',') : mailOptions.to}, subject=${mailOptions.subject}`,
      );
      return false;
    }
    // Validate that either htmlContent or textContent is provided
    if (!mailOptions.htmlContent && !mailOptions.textContent) {
      this.logger.error(
        'Either htmlContent or textContent is required for sending email',
      );
      return false;
    }

    const recipients = Array.isArray(mailOptions.to)
      ? mailOptions.to.map((email) => ({ email }))
      : [{ email: mailOptions.to }];

    const invalidEmails = recipients.filter((r) => !this.isValidEmail(r.email));
    if (invalidEmails.length > 0) {
      this.logger.warn(
        `Invalid email(s): ${invalidEmails.map((r) => r.email).join(', ')}`,
      );
      return false;
    }

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = mailOptions.sender || {
      name: 'Englishom',
      email: 'no-reply@englishom.com',
    };
    sendSmtpEmail.to = recipients;
    sendSmtpEmail.subject = mailOptions.subject;
    sendSmtpEmail.htmlContent = mailOptions.htmlContent;
    sendSmtpEmail.textContent = mailOptions.textContent;
    if (mailOptions.cc) {
      sendSmtpEmail.cc = mailOptions.cc.map((email) => ({ email }));
    }
    if (mailOptions.bcc) {
      sendSmtpEmail.bcc = mailOptions.bcc.map((email) => ({ email }));
    }
    if (mailOptions.replyTo) {
      sendSmtpEmail.replyTo = mailOptions.replyTo;
    }
    if (mailOptions.attachments) {
      sendSmtpEmail.attachment = mailOptions.attachments;
    }

    this.logger.log(
      `Sending custom email to ${recipients.map((r) => r.email).join(', ')}...`,
    );

    const result = await this.sendWithRetry(
      () => this.apiInstance.sendTransacEmail(sendSmtpEmail),
      `sendCustomEmail to ${recipients.map((r) => r.email).join(', ')}`,
    );

    if (result) {
      this.logger.log(
        `Custom email sent successfully. Message ID: ${result.body?.messageId || 'N/A'}`,
      );
      return true;
    }
    return false;
  }

  /**
   * Test the Brevo API connection and API key validity
   * @returns Promise<boolean> - true if connection is successful
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled || !this.apiInstance) {
      this.logger.warn(
        'MailService is disabled (no API key). Connection test skipped.',
      );
      return false;
    }
    try {
      this.logger.log('Testing Brevo API connection...');

      // Try to send a test email to a dummy address to verify API key
      const testEmail = new SendSmtpEmail();
      testEmail.sender = {
        name: 'Englishom Test',
        email: 'no-reply@englishom.com',
      };
      testEmail.to = [{ email: 'test@example.com' }]; // This won't actually send
      testEmail.subject = 'Connection Test';
      testEmail.htmlContent = '<p>This is a connection test</p>';

      // Note: This might fail with invalid email, but we're mainly testing auth
  await this.apiInstance.sendTransacEmail(testEmail);

      this.logger.log('Brevo API connection test successful');
      return true;
    } catch (err: any) {
      if (err.response?.status === 401) {
        this.logger.error('Brevo API Key Authentication Failed!');
        this.logger.error(
          'Please check your BREVO_API_KEY in environment variables',
        );
        return false;
      } else if (
        err.response?.status === 400 &&
        err.response?.data?.message?.includes('email')
      ) {
        // This might happen with test email, but auth is working
        this.logger.log(
          'Brevo API authentication successful (test email validation failed as expected)',
        );
        return true;
      } else {
        this.logger.error(`Brevo API connection test failed: ${err.message}`);
        if (err.response) {
          this.logger.error('Error details:', {
            status: err.response.status,
            data: err.response.data,
          });
        }
        return false;
      }
    }
  }

  // Retry helper: attempts operation up to 1 + maxRetries times; returns result or null
  private async sendWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries = 2,
    baseDelayMs = 300,
  ): Promise<T | null> {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const res = await operation();
        if (attempt > 0) {
          this.logger.warn(`Email ${context} succeeded after ${attempt} retr${attempt === 1 ? 'y' : 'ies'}`);
        }
        return res;
      } catch (err: any) {
        this.logBrevoError(err, `${context} (attempt ${attempt + 1})`);
        if (attempt === maxRetries) {
          this.logger.error(`Email ${context} failed after ${attempt + 1} attempts`);
          return null;
        }
        const delay = baseDelayMs * (attempt + 1);
        await this.delay(delay);
        attempt++;
      }
    }
    return null;
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private logBrevoError(err: any, context: string) {
    this.logger.error(`Failed to ${context}: ${err?.message ?? err}`);
    if (err?.response) {
      this.logger.error(`Brevo API Error Details:`, {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        headers: err.response.headers,
      });
      if (err.response.status === 401) {
        this.logger.error('Authentication failed - Check your Brevo API key');
        this.logger.error(
          'Ensure BREVO_API_KEY is correctly set in your environment variables',
        );
      }
    } else if (err?.request) {
      this.logger.error('No response received from Brevo API:', err.request);
    } else if (err) {
      this.logger.error('Error setting up the request:', err.message ?? String(err));
    }
  }
}

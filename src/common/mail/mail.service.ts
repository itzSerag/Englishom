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
  private readonly apiInstance: TransactionalEmailsApi;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.error(
        'BREVO_API_KEY is not configured in environment variables',
      );
      throw new Error('BREVO_API_KEY is not configured');
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

    this.logger.log('MailService initialized with Brevo API');
  }

  async sendEmail(to: string, otp: string, cause?: OtpCause): Promise<boolean> {
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

    try {
      this.logger.log(`Sending email to ${to}...`);
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(
        `Email sent successfully to ${to}. Message ID: ${result.body?.messageId || 'N/A'}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to send email to ${to}: ${err.message}`,
        err.stack,
      );

      // Enhanced error logging
      if (err.response) {
        this.logger.error(`Brevo API Error Details:`, {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers,
        });

        // Specific handling for 401 errors
        if (err.response.status === 401) {
          this.logger.error('Authentication failed - Check your Brevo API key');
          this.logger.error(
            'Ensure BREVO_API_KEY is correctly set in your environment variables',
          );
        }
      } else if (err.request) {
        this.logger.error('No response received from Brevo API:', err.request);
      } else {
        this.logger.error('Error setting up the request:', err.message);
      }

      return false;
    }
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
    try {
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

      const invalidEmails = recipients.filter(
        (r) => !this.isValidEmail(r.email),
      );
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
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(
        `Custom email sent successfully. Message ID: ${result.body?.messageId || 'N/A'}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Custom email sending failed: ${err.message}`,
        err.stack,
      );

      // Enhanced error logging
      if (err.response) {
        this.logger.error(`Brevo API Error Details:`, {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
          headers: err.response.headers,
        });

        // Specific handling for 401 errors
        if (err.response.status === 401) {
          this.logger.error('Authentication failed - Check your Brevo API key');
          this.logger.error(
            'Ensure BREVO_API_KEY is correctly set in your environment variables',
          );
        }
      } else if (err.request) {
        this.logger.error('No response received from Brevo API:', err.request);
      } else {
        this.logger.error('Error setting up the request:', err.message);
      }

      return false;
    }
  }

  /**
   * Test the Brevo API connection and API key validity
   * @returns Promise<boolean> - true if connection is successful
   */
  async testConnection(): Promise<boolean> {
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
}

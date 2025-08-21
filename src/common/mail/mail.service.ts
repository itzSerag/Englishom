import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SendSmtpEmail,
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from '@getbrevo/brevo';
import { OtpCause } from '../../auth/enum/otp-cause.enum';

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
  private apiInstance: TransactionalEmailsApi;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

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
    sendSmtpEmail.sender = { name: 'Englishom', email: 'no-reply@englishom.com' };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;

    try {
      this.logger.log(`Sending email to ${to}...`);
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`, err.stack);
      if (err.response) {
        this.logger.error(`Brevo API response: ${JSON.stringify(err.response.body)}`);
      }
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getEmailTemplate(otp: string, cause?: OtpCause): { subject: string; htmlContent: string } {
    let subject = 'Your OTP';
    let message = 'Your OTP is:';
    let additionalInfo = '';

    if (cause === OtpCause.EMAIL_VERIFICATION) {
      subject = 'Email Verification - Your OTP';
      message = 'Please verify your email address with this OTP:';
      additionalInfo = '<p style="color: #666;">This OTP is for email verification and will expire in 10 minutes.</p>';
    } else if (cause === OtpCause.FORGET_PASSWORD) {
      subject = 'Password Reset - Your OTP';
      message = 'Use this OTP to reset your password:';
      additionalInfo = '<p style="color: #666;">This OTP is for password reset and will expire in 10 minutes.</p>';
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
      const recipients = Array.isArray(mailOptions.to)
        ? mailOptions.to.map(email => ({ email }))
        : [{ email: mailOptions.to }];

      const invalidEmails = recipients.filter(r => !this.isValidEmail(r.email));
      if (invalidEmails.length > 0) {
        this.logger.warn(`Invalid email(s): ${invalidEmails.map(r => r.email).join(', ')}`);
        return false;
      }

      const sendSmtpEmail = new SendSmtpEmail();
      sendSmtpEmail.sender = mailOptions.sender || { name: 'Englishom', email: 'no-reply@englishom.com' };
      sendSmtpEmail.to = recipients;
      sendSmtpEmail.subject = mailOptions.subject;
      sendSmtpEmail.htmlContent = mailOptions.htmlContent;
      sendSmtpEmail.textContent = mailOptions.textContent;
      if (mailOptions.cc) {
        sendSmtpEmail.cc = mailOptions.cc.map(email => ({ email }));
      }
      if (mailOptions.bcc) {
        sendSmtpEmail.bcc = mailOptions.bcc.map(email => ({ email }));
      }
      if (mailOptions.replyTo) {
        sendSmtpEmail.replyTo = mailOptions.replyTo;
      }
      if (mailOptions.attachments) {
        sendSmtpEmail.attachment = mailOptions.attachments;
      }

      this.logger.log(`Sending custom email to ${recipients.map(r => r.email).join(', ')}...`);
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      this.logger.log(`Custom email sent successfully`);
      return true;
    } catch (err: any) {
      this.logger.error(`Custom email sending failed: ${err.message}`, err.stack);
      if (err.response) {
        this.logger.error(`Brevo API response: ${JSON.stringify(err.response.body)}`);
      }
      return false;
    }
  }
}

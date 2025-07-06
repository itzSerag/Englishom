import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpCause } from '../../auth/enum/otp-cause.enum';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'), // e.g. mail.yourdomain.com
      port: this.configService.get<number>('SMTP_PORT'), // 465 for SSL or 587 for TLS
      secure: this.configService.get<number>('SMTP_PORT') === 465, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'), // no-reply@yourdomain.com
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      // Add timeout configurations to prevent hanging on invalid domains
      connectionTimeout: 10000, // 10 seconds connection timeout
      greetingTimeout: 10000, // 10 seconds greeting timeout
      socketTimeout: 15000, // 15 seconds socket timeout
      // Add retry configuration
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 5, // max 5 emails per second
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
      // Add debugging in development
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    });
  }

  async sendEmail(to: string, otp: string, cause?: OtpCause): Promise<any> {
    // Validate email format before attempting to send
    if (!this.isValidEmail(to)) {
      throw new Error(`Invalid email address: ${to}`);
    }

    let subject = 'Your OTP';
    let message = 'Your OTP is:';
    let additionalInfo = '';

    // Customize message based on OTP cause
    if (cause === OtpCause.EMAIL_VERIFICATION) {
      subject = 'Email Verification - Your OTP';
      message = 'Please verify your email address with this OTP:';
      additionalInfo =
        '<p style="color: #666; font-size: 14px;">This OTP is for email verification and will expire in 10 minutes.</p>';
    } else if (cause === OtpCause.FORGET_PASSWORD) {
      subject = 'Password Reset - Your OTP';
      message = 'Use this OTP to reset your password:';
      additionalInfo =
        '<p style="color: #666; font-size: 14px;">This OTP is for password reset and will expire in 10 minutes.</p>';
    }

    const mailOptions = {
      from: `"Englishom" <${this.configService.get<string>('SMTP_USER')}>`,
      to,
      subject,
      html: `
        <html>
          <head>
            <style>
              .container {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              .content {
                padding: 20px;
                border: 1px solid #ccc;
                border-radius: 10px;
                box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
              }
              .content h1 {
                color: #333;
                font-size: 24px;
                margin-bottom: 20px;
              }
              .content p {
                color: #666;
                font-size: 16px;
              }
              .content .otp {
                color: #333;
                font-size: 18px;
                font-weight: bold;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <h1>Hi there!</h1>
                <p>${message}</p>
                <p class="otp">${otp}</p>
                ${additionalInfo}
                <p>Thanks</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    try {
      return await this.sendMailWithTimeout(mailOptions);
    } catch (error) {
      // Log the error but provide a more user-friendly message
      console.error(`Failed to send email to ${to}:`, error.message);
      throw new Error(`Failed to send email: ${this.getEmailErrorMessage(error)}`);
    }
  }

  async sendCustomEmail(mailOptions: any): Promise<any> {
    try {
      // Validate email before sending
      if (mailOptions.to && !this.isValidEmail(mailOptions.to)) {
        throw new Error(`Invalid email address: ${mailOptions.to}`);
      }
      
      return await this.sendMailWithTimeout(mailOptions);
    } catch (error) {
      // Log the error but provide a more user-friendly message
      console.error(`Failed to send custom email to ${mailOptions.to}:`, error.message);
      throw new Error(`Failed to send email: ${this.getEmailErrorMessage(error)}`);
    }
  }

  /**
   * Send email with timeout protection
   */
  private async sendMailWithTimeout(mailOptions: any, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Email sending timed out after ${timeoutMs}ms. This may be due to an invalid email domain.`));
      }, timeoutMs);

      // Send email
      this.transporter.sendMail(mailOptions, (error, info) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(info);
        }
      });
    });
  }

  /**
   * Validate email format and basic domain checks
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // Extract domain
    const domain = email.split('@')[1];
    if (!domain) {
      return false;
    }

    // Check for obviously invalid domains
    const invalidDomains = [
      'example.com',
      'test.com',
      'localhost',
      'undefined.com',
      'null.com',
      'invalid.com',
      'fake.com',
      'dummy.com',
      'temp.com',
      'temporary.com'
    ];

    if (invalidDomains.includes(domain.toLowerCase())) {
      return false;
    }

    // Check domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  /**
   * Get user-friendly error message from email error
   */
  private getEmailErrorMessage(error: any): string {
    if (error.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('timed out')) {
        return 'Email sending timed out. Please check if the email address is valid.';
      }
      
      if (message.includes('invalid') || message.includes('malformed')) {
        return 'Invalid email address format.';
      }
      
      if (message.includes('connection') || message.includes('connect')) {
        return 'Unable to connect to email server. Please try again later.';
      }
      
      if (message.includes('authentication') || message.includes('auth')) {
        return 'Email service authentication failed.';
      }
      
      if (message.includes('domain') || message.includes('host')) {
        return 'Invalid email domain. Please check the email address.';
      }
    }
    
    return 'Unable to send email at this time. Please try again later.';
  }
}

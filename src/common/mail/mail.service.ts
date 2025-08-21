import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpCause } from '../../auth/enum/otp-cause.enum';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: parseInt(this.configService.get('SMTP_PORT')),
      secure: true,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
      // Add connection and socket timeout configurations
      connectionTimeout: 60000, // 60 seconds connection timeout
      greetingTimeout: 30000,   // 30 seconds greeting timeout
      socketTimeout: 60000,     // 60 seconds socket timeout
    });

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (error) {
      console.error('❌ SMTP connection failed:', error.message);
      console.error('SMTP Config:', {
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT'),
        user: this.configService.get('SMTP_USER'),
        secure: this.configService.get('SMTP_PORT') === '465',
      });
    }
  }

  sendEmail(to: string, otp: string, cause?: OtpCause): void {
    if (!this.isValidEmail(to)) {
      console.warn(`Invalid email format: ${to}`);
      return;
    }

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

    const mailOptions = {
      from: `"Englishom" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 10px;">
          <h1 style="color: #333;">Hi there!</h1>
          <p>${message}</p>
          <p style="font-weight: bold; font-size: 18px;">${otp}</p>
          ${additionalInfo}
          <p>Thanks,<br>The Englishom Team</p>
        </div>
      `,
    };

    console.log(`🚀 Attempting to send email to ${to} with subject: ${subject}`);

    this.sendMailWithTimeout(mailOptions)
      .then(() => console.log(`✅ Email sent successfully to ${to}`))
      .catch((err) => {
        console.error(`❌ Email sending failed to ${to}:`, err.message);
        if (err.code) {
          console.error(`Error code: ${err.code}`);
        }
        if (err.response) {
          console.error(`SMTP response: ${err.response}`);
        }
      });
  }

  private async sendMailWithTimeout(mailOptions: any): Promise<any> {
    // Get timeout from environment variable or use default of 120 seconds (2 minutes)
    const timeoutMs = parseInt(this.configService.get('EMAIL_TIMEOUT_MS', '120000'));
    
    return Promise.race([
      this.transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Email timeout after ${timeoutMs / 1000} seconds`)), timeoutMs),
      ),
    ]);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendCustomEmail(mailOptions: any): Promise<any> {
    return this.transporter.sendMail(mailOptions);
  }
}

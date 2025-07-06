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
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_PORT') === 465,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      }
    })
  }

  // ✅ Fire-and-forget wrapper
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
          <p>Thanks</p>
        </div>
      `,
    };

    // Fire and forget 🚀
    this.sendMailWithTimeout(mailOptions)
      .then(() => console.log(`Email sent to ${to}`))
      .catch((err) => console.error(`Email sending failed to ${to}:`, err.message));
  }

  // ✅ Manual timeout fallback
  private async sendMailWithTimeout(mailOptions: any): Promise<any> {
    return Promise.race([
      this.transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 5000),
      ),
    ]);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // optional: still keep this if you want to manually call it elsewhere
  async sendCustomEmail(mailOptions: any): Promise<any> {
    return this.transporter.sendMail(mailOptions);
  }
}

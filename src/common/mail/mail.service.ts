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
      secure: true,
      auth: {
        user: this.configService.get<string>('SMTP_USER'), // no-reply@yourdomain.com
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmail(to: string, otp: string, cause?: OtpCause): Promise<any> {
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

    return this.transporter.sendMail(mailOptions);
  }

  async sendCustomEmail(mailOptions: any): Promise<any> {
    return this.transporter.sendMail(mailOptions);
  }
}

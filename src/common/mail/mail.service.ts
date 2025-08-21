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
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
      // Enhanced timeout and connection configurations for VPS environments
      connectionTimeout: 120000, // 2 minutes connection timeout
      greetingTimeout: 60000,    // 1 minute greeting timeout  
      socketTimeout: 120000,     // 2 minutes socket timeout
      // Additional VPS-friendly options
      pool: true,                // Use connection pooling
      maxConnections: 5,         // Limit concurrent connections
      maxMessages: 100,          // Messages per connection
      // TLS options for better compatibility
      tls: {
        // Don't fail on invalid certs in development
        rejectUnauthorized: this.configService.get('NODE_ENV') === 'production',
      },
      // Debug logging
      debug: this.configService.get('NODE_ENV') !== 'production',
      logger: this.configService.get('NODE_ENV') !== 'production',
    } as any);

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
        nodeEnv: this.configService.get('NODE_ENV'),
      });
      
      // Additional debugging for VPS issues
      if (error.code) {
        console.error(`❌ Error code: ${error.code}`);
      }
      if (error.errno) {
        console.error(`❌ Error number: ${error.errno}`);
      }
      if (error.syscall) {
        console.error(`❌ System call: ${error.syscall}`);
      }
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
    console.log(`📧 Environment: ${this.configService.get('NODE_ENV')}`);
    console.log(`📡 SMTP Host: ${this.configService.get('SMTP_HOST')}:${this.configService.get('SMTP_PORT')}`);

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
        if (err.errno) {
          console.error(`Error number: ${err.errno}`);
        }
        if (err.syscall) {
          console.error(`System call: ${err.syscall}`);
        }
        
        // Suggest troubleshooting steps
        console.error('🔍 Troubleshooting suggestions:');
        console.error('  1. Check if SMTP port is open on VPS firewall');
        console.error('  2. Verify DNS resolution for SMTP host');
        console.error('  3. Check if email provider blocks VPS IP ranges');
        console.error('  4. Try using a different SMTP port (587 instead of 465)');
      });
  }

  private async sendMailWithTimeout(mailOptions: any): Promise<any> {
    // Get timeout from environment variable or use default of 180 seconds (3 minutes) for VPS
    const timeoutMs = parseInt(this.configService.get('EMAIL_TIMEOUT_MS', '180000'));
    
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

  // New method to test SMTP connection manually
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('🧪 Test connection successful');
      return true;
    } catch (error) {
      console.error('🧪 Test connection failed:', error.message);
      return false;
    }
  }

  // Alternative method without timeout for debugging
  async sendEmailDirectly(mailOptions: any): Promise<any> {
    console.log('📧 Sending email directly without timeout wrapper...');
    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Direct email send successful:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Direct email send failed:', error);
      throw error;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpCause } from '../../auth/enum/otp-cause.enum';

interface EmailConfig {
  port: number;
  secure: boolean;
  name: string;
  description: string;
}

interface EmailTemplate {
  subject: string;
  message: string;
  additionalInfo: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);
  private isConnected = false;
  private currentConfig: EmailConfig | null = null;

  private readonly emailConfigs: EmailConfig[] = [
    { port: 587, secure: false, name: 'STARTTLS', description: 'Port 587 with STARTTLS (Recommended)' },
    { port: 465, secure: true, name: 'SSL', description: 'Port 465 with SSL/TLS' },
    { port: 25, secure: false, name: 'Plain', description: 'Port 25 (Often blocked on VPS)' },
  ];

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    this.logger.log('🚀 Initializing Email Service...');
    
    // Try to use specified configuration first
    const specifiedPort = this.configService.get('SMTP_PORT');
    if (specifiedPort) {
      const success = await this.tryConfiguration(parseInt(specifiedPort));
      if (success) return;
    }

    // If specified config fails or not provided, try all configurations
    await this.testMultipleConfigurations();
  }

  private async tryConfiguration(port: number): Promise<boolean> {
    const config = this.emailConfigs.find(c => c.port === port) || 
                   { port, secure: port === 465, name: 'Custom', description: `Port ${port}` };

    this.logger.log(`🧪 Testing ${config.description}...`);

    try {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: config.port,
        secure: config.secure,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
        tls: {
          servername: this.configService.get('SMTP_HOST'),
          rejectUnauthorized: this.configService.get('NODE_ENV') === 'production'
        },
        connectionTimeout: parseInt(this.configService.get('EMAIL_TIMEOUT_MS', '60000')),
        greetingTimeout: 30000,
        socketTimeout: 60000,
        debug: this.configService.get('NODE_ENV') === 'development',
        logger: this.configService.get('NODE_ENV') === 'development',
      });

      await this.verifyConnection();
      this.isConnected = true;
      this.currentConfig = config;
      this.logger.log(`✅ Successfully configured with ${config.description}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ ${config.description} failed: ${error.message}`);
      return false;
    }
  }

  private async testMultipleConfigurations(): Promise<void> {
    this.logger.log('🔄 Testing multiple SMTP configurations...');

    for (const config of this.emailConfigs) {
      const success = await this.tryConfiguration(config.port);
      if (success) return;
    }

    // If all fail, provide detailed troubleshooting
    this.logger.error('❌ All SMTP configurations failed!');
    this.logTroubleshootingInfo();
    
    // Set up a dummy transporter to prevent crashes
    this.setupFallbackTransporter();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('✅ SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('❌ SMTP connection failed:', error.message);
      this.logConnectionError(error);
      throw error;
    }
  }

  private logConnectionError(error: any): void {
    const config = {
      host: this.configService.get('SMTP_HOST'),
      port: this.currentConfig?.port || this.configService.get('SMTP_PORT'),
      user: this.configService.get('SMTP_USER'),
      secure: this.currentConfig?.secure,
      nodeEnv: this.configService.get('NODE_ENV'),
    };

    this.logger.error('SMTP Config:', config);
    
    if (error.code) this.logger.error(`Error code: ${error.code}`);
    if (error.errno) this.logger.error(`Error number: ${error.errno}`);
    if (error.syscall) this.logger.error(`System call: ${error.syscall}`);
    if (error.response) this.logger.error(`SMTP response: ${error.response}`);
  }

  private logTroubleshootingInfo(): void {
    this.logger.error('🔍 DigitalOcean VPS Troubleshooting Guide:');
    this.logger.error('  1. SMTP ports might be blocked by DigitalOcean');
    this.logger.error('  2. Contact DO support to unblock SMTP ports');
    this.logger.error('  3. Check VPS firewall: sudo ufw status');
    this.logger.error('  4. Test connectivity: telnet ' + this.configService.get('SMTP_HOST') + ' 587');
    this.logger.error('  5. Consider using SendGrid/Mailgun instead');
    this.logger.error('  6. Verify DNS resolution: nslookup ' + this.configService.get('SMTP_HOST'));
  }

  private setupFallbackTransporter(): void {
    this.logger.warn('⚠️ Setting up fallback transporter (emails will not be sent)');
    this.transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
    this.isConnected = false;
  }

  private getEmailTemplate(cause?: OtpCause): EmailTemplate {
    const templates: Record<OtpCause, EmailTemplate> = {
      [OtpCause.EMAIL_VERIFICATION]: {
        subject: 'Email Verification - Your OTP',
        message: 'Please verify your email address with this OTP:',
        additionalInfo: '<p style="color: #666; font-size: 14px;">This OTP is for email verification and will expire in 10 minutes.</p>'
      },
      [OtpCause.FORGET_PASSWORD]: {
        subject: 'Password Reset - Your OTP',
        message: 'Use this OTP to reset your password:',
        additionalInfo: '<p style="color: #666; font-size: 14px;">This OTP is for password reset and will expire in 10 minutes.</p>'
      }
    };

    return templates[cause] || {
      subject: 'Your OTP Code',
      message: 'Your verification code is:',
      additionalInfo: '<p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>'
    };
  }

  private generateEmailHTML(otp: string, template: EmailTemplate): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 40px 30px; text-align: center;">
            <div style="margin-bottom: 30px;">
              <h1 style="color: #333333; font-size: 28px; margin: 0 0 10px 0;">Englishom</h1>
              <div style="width: 50px; height: 3px; background-color: #007bff; margin: 0 auto;"></div>
            </div>
            
            <h2 style="color: #333333; font-size: 24px; margin-bottom: 20px;">Hi there! 👋</h2>
            
            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
              ${template.message}
            </p>
            
            <div style="background-color: #f8f9fa; border: 2px dashed #007bff; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
              <p style="color: #007bff; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 3px;">
                ${otp}
              </p>
            </div>
            
            ${template.additionalInfo}
            
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eeeeee;">
              <p style="color: #333333; font-size: 16px; margin-bottom: 5px;">
                Thanks,<br>
                <strong>The Englishom Team</strong>
              </p>
            </div>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              If you didn't request this OTP, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmail(to: string, otp: string, cause?: OtpCause): Promise<boolean> {
    if (!this.isValidEmail(to)) {
      this.logger.warn(`Invalid email format: ${to}`);
      return false;
    }

    if (!this.isConnected) {
      this.logger.error('❌ Email service not connected. Attempting to reconnect...');
      await this.initializeTransporter();
      if (!this.isConnected) {
        this.logger.error('❌ Failed to reconnect email service');
        return false;
      }
    }

    const template = this.getEmailTemplate(cause);
    const mailOptions = {
      from: `"Englishom" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: template.subject,
      html: this.generateEmailHTML(otp, template),
    };

    this.logger.log(`🚀 Sending email to ${to} - ${template.subject}`);
    this.logger.debug(`📧 Using ${this.currentConfig?.description || 'Unknown config'}`);

    try {
      const result = await this.sendMailWithTimeout(mailOptions);
      this.logger.log(`✅ Email sent successfully to ${to} (Message ID: ${result.messageId})`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Email sending failed to ${to}: ${error.message}`);
      this.logEmailError(error);
      return false;
    }
  }

  private logEmailError(error: any): void {
    if (error.code) this.logger.error(`Error code: ${error.code}`);
    if (error.response) this.logger.error(`SMTP response: ${error.response}`);
    if (error.errno) this.logger.error(`Error number: ${error.errno}`);
    if (error.syscall) this.logger.error(`System call: ${error.syscall}`);
    
    this.logger.error('🔧 Quick fixes to try:');
    this.logger.error('  1. Restart the application');
    this.logger.error('  2. Check internet connectivity');
    this.logger.error('  3. Verify email credentials');
    this.logger.error('  4. Try alternative SMTP service (SendGrid/Mailgun)');
  }

  private async sendMailWithTimeout(mailOptions: any): Promise<any> {
    const timeoutMs = parseInt(this.configService.get('EMAIL_TIMEOUT_MS', '90000'));
    
    return Promise.race([
      this.transporter.sendMail(mailOptions),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Email timeout after ${timeoutMs / 1000} seconds`)), timeoutMs)
      ),
    ]);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Public methods for testing and diagnostics
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('🧪 Manual connection test successful');
      return true;
    } catch (error) {
      this.logger.error('🧪 Manual connection test failed:', error.message);
      return false;
    }
  }

  async sendTestEmail(to: string): Promise<boolean> {
    const mailOptions = {
      from: `"Englishom Test" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: 'Email Service Test',
      html: `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2>✅ Email Service Test Successful!</h2>
          <p>This is a test email from your Englishom application.</p>
          <p><strong>Configuration:</strong> ${this.currentConfig?.description || 'Unknown'}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    };

    try {
      await this.sendMailWithTimeout(mailOptions);
      this.logger.log(`✅ Test email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Test email failed: ${error.message}`);
      return false;
    }
  }

  async sendCustomEmail(mailOptions: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Email service not connected');
    }
    return this.sendMailWithTimeout(mailOptions);
  }

  // Health check method
  getServiceHealth(): {
    connected: boolean;
    configuration: string;
    lastError?: string;
  } {
    return {
      connected: this.isConnected,
      configuration: this.currentConfig?.description || 'Not configured',
    };
  }

  // Method to switch to alternative email provider
  async switchToProvider(provider: 'sendgrid' | 'mailgun'): Promise<boolean> {
    this.logger.log(`🔄 Switching to ${provider.toUpperCase()}...`);

    const configs = {
      sendgrid: {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
        passEnvKey: 'SENDGRID_API_KEY'
      },
      mailgun: {
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        user: this.configService.get('MAILGUN_SMTP_USER'),
        passEnvKey: 'MAILGUN_SMTP_PASS'
      }
    };

    const config = configs[provider];
    const password = this.configService.get(config.passEnvKey);

    if (!password) {
      this.logger.error(`❌ Missing ${config.passEnvKey} environment variable`);
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: password,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });

      await this.verifyConnection();
      this.isConnected = true;
      this.currentConfig = { 
        port: config.port, 
        secure: config.secure, 
        name: provider.toUpperCase(), 
        description: `${provider.toUpperCase()} SMTP Service` 
      };
      
      this.logger.log(`✅ Successfully switched to ${provider.toUpperCase()}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to switch to ${provider}: ${error.message}`);
      return false;
    }
  }
}
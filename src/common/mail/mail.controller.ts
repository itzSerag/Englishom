import { Controller, Post, Body, Logger, Get } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  private readonly logger = new Logger(MailController.name);

  constructor(private readonly mailService: MailService) {}

  @Get('test-connection')
  async testConnection() {
    this.logger.log('Testing mail service connection...');
    const isConnected = await this.mailService.testConnection();

    return {
      success: isConnected,
      message: isConnected
        ? 'Mail service connection successful'
        : 'Mail service connection failed - check logs for details',
    };
  }

  @Post('test-send')
  async testSend(@Body() body: { email: string; otp?: string }) {
    this.logger.log(`Testing email send to: ${body.email}`);

    if (!body.email) {
      return {
        success: false,
        message: 'Email address is required',
      };
    }

    const otp = body.otp || '123456';
    const result = await this.mailService.sendEmail(body.email, otp);

    return {
      success: result,
      message: result
        ? 'Test email sent successfully'
        : 'Failed to send test email - check logs for details',
    };
  }
}

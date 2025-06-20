import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRepo } from '../user/repo/user.repo';
import { EmailService } from '../common/mail/mail.service';
import { Role } from '../common/shared';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InactiveUserCronService {
  private readonly logger = new Logger(InactiveUserCronService.name);
  private readonly emailTemplate: string;

  constructor(
    private readonly userRepo: UserRepo,
    private readonly emailService: EmailService,
  ) {
    try {
      const templatePath = path.join(__dirname, 'email-template.html');
      this.emailTemplate = fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      // Fallback template if file loading fails
      this.logger.error('Failed to load email template file, using fallback template');
      this.emailTemplate = this.getFallbackTemplate();
    }
  }

  @Cron('0 9 * * *', {
    name: 'send-inactive-user-emails',
    timeZone: 'Asia/Riyadh'
  })
  async handleInactiveUsers() {
    const startTime = new Date();
    this.logger.log('🔄 Starting inactive user email job...');

    try {
      // Calculate 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find inactive users (exclude admins)
      const inactiveUsers = await this.userRepo.find({
        lastActivity: { $lt: sevenDaysAgo },
        role: { $ne: Role.ADMIN },
        isVerified: true, // Only send to verified users
      });

      this.logger.log(`📧 Found ${inactiveUsers.length} inactive users`);

      if (inactiveUsers.length === 0) {
        this.logger.log('✅ No inactive users found. Job completed.');
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      // Process each inactive user
      for (const user of inactiveUsers) {
        try {
          await this.sendMotivationalEmail(user);
          successCount++;
          this.logger.debug(`✉️ Email sent to: ${user.email}`);
        } catch (error) {
          failureCount++;
          this.logger.error(`❌ Failed to send email to ${user.email}: ${error.message}`);
        }

        // Add small delay to avoid overwhelming email service
        await this.delay(300);
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      this.logger.log(`✅ Inactive user email job completed in ${duration}s`);
      this.logger.log(`📊 Results: ${successCount} successful, ${failureCount} failed`);

    } catch (error) {
      this.logger.error(`💥 Error in inactive user job: ${error.message}`, error.stack);
    }
  }

  private async sendMotivationalEmail(user: any): Promise<void> {
    // Replace template variables
    const personalizedEmail = this.emailTemplate
      .replace(/{{userName}}/g, user.firstName || 'there')
      .replace(/{{loginUrl}}/g, process.env.FRONTEND_URL || 'https://englishom.com/login');

    // Prepare email data
    const mailOptions = {
      from: `"Englishom Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "We miss you! Come back and continue your English journey 🌟",
      html: personalizedEmail,
    };

    // Send email using the existing email service
    // We need to modify the existing sendEmail method or create a new one
    await this.sendCustomEmail(mailOptions);
  }

  private async sendCustomEmail(mailOptions: any): Promise<void> {
    // Use the new sendCustomEmail method from EmailService
    await this.emailService.sendCustomEmail(mailOptions);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger method for testing (optional)
  async triggerManually(): Promise<void> {
    this.logger.log('🔧 Manually triggering inactive user email job...');
    await this.handleInactiveUsers();
  }

  private getFallbackTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f8f9fa; }
        .button { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>We Miss You at Englishom! 📚</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}},</p>
            <p>We noticed you haven't been active on Englishom lately. Don't let your English learning progress slip away!</p>
            <p>Come back and continue your journey to English mastery.</p>
            <a href="{{loginUrl}}" class="button">Continue Learning</a>
            <p>Keep learning, keep growing!</p>
            <p>The Englishom Team</p>
        </div>
    </div>
</body>
</html>`;
  }
}

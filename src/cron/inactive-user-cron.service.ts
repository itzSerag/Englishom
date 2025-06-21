import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
      this.logger.error(
        'Failed to load email template file, using fallback template',
      );
      this.emailTemplate = this.getFallbackTemplate();
    }
  }

  @Cron('0 9 * * *', {
    name: 'send-inactive-user-emails',
    timeZone: 'Asia/Riyadh',

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
          this.logger.error(
            `❌ Failed to send email to ${user.email}: ${error.message}`,
          );
        }

        // Add small delay to avoid overwhelming email service
        await this.delay(300);
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      this.logger.log(`✅ Inactive user email job completed in ${duration}s`);
      this.logger.log(
        `📊 Results: ${successCount} successful, ${failureCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        `💥 Error in inactive user job: ${error.message}`,
        error.stack,
      );
    }
  }

  private async sendMotivationalEmail(user: any): Promise<void> {
    // Replace template variables
    const personalizedEmail = this.emailTemplate
      .replace(/{{userName}}/g, user.firstName || 'there')
      .replace(
        /{{loginUrl}}/g,
        process.env.FRONTEND_URL || 'https://englishom.com/login',
      );

    // Prepare email data
    const mailOptions = {
      from: `"Englishom Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'We miss you! Come back and continue your English journey 🌟',
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8f9fa;
            padding: 30px 20px;
            border-radius: 0 0 10px 10px;
        }
        .emoji {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">📚✨</div>
            <h1>We Miss You at Englishom!</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}},</p>
            
            <p>We noticed you haven't been active on Englishom lately, and we wanted to reach out because your English learning journey is important to us! 🌟</p>
            
            <p><strong>Don't let your progress slip away!</strong> Every day you practice English is a step closer to your goals. Whether you're preparing for exams, career advancement, or personal growth, consistency is key to success.</p>
            
            <p>Here's what's waiting for you when you return:</p>
            <ul>
                <li>🎯 Your personalized learning path</li>
                <li>📈 Track your progress and achievements</li>
                <li>🏆 Earn certificates as you complete levels</li>
                <li>💪 Build confidence with daily practice</li>
            </ul>
            
            <p>Remember, even 10 minutes of practice can make a big difference. Your future self will thank you for not giving up!</p>
            
            <div style="text-align: center;">
                <a href="{{loginUrl}}" class="cta-button">Continue Learning Now</a>
            </div>
            
            <p>We believe in you and your ability to master English. Come back and let's continue this amazing journey together!</p>
            
            <p>Keep learning, keep growing! 🚀</p>
            
            <p>With encouragement,<br>
            <strong>The Englishom Team</strong></p>
        </div>
        <div class="footer">
            <p>© 2024 Englishom. Empowering English learners worldwide.</p>
        </div>
    </div>
</body>
</html>
`;
  }
}

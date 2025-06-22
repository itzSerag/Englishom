import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRepo } from '../user/repo/user.repo';
import { EmailService } from '../common/mail/mail.service';
import { Role, UserStatus } from '../common/shared';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InactiveUserCronService {
  private readonly logger = new Logger(InactiveUserCronService.name);
  private readonly emailTemplate: string;
  private readonly suspensionEmailTemplate: string;

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

    try {
      const suspensionTemplatePath = path.join(__dirname, 'suspension-email-template.html');
      this.suspensionEmailTemplate = fs.readFileSync(suspensionTemplatePath, 'utf8');
    } catch (error) {
      // Fallback template if file loading fails
      this.logger.error(
        'Failed to load suspension email template file, using fallback template',
      );
      this.suspensionEmailTemplate = this.getSuspensionEmailTemplate();
    }
  }

  @Cron('0 9 * * *', {
    name: 'check-inactive-users',
    timeZone: 'Asia/Riyadh',
  })
  async handleInactiveUsers() {
    const startTime = new Date();
    this.logger.log('🔄 Starting inactive user management job...');

    try {
      // Calculate 7 days ago for motivational emails
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Calculate 65 days ago for suspension
      const sixtyFiveDaysAgo = new Date();
      sixtyFiveDaysAgo.setDate(sixtyFiveDaysAgo.getDate() - 65);

      // Find users to suspend (65+ days inactive)
      const usersToSuspend = await this.userRepo.find({
        lastActivity: { $lt: sixtyFiveDaysAgo },
        role: { $ne: Role.ADMIN },
        isVerified: true,
        status: UserStatus.ACTIVE, // Only suspend active users
      });

      // Find users for motivational emails (7+ days inactive but less than 65 days)
      const usersForMotivation = await this.userRepo.find({
        lastActivity: { $gte: sixtyFiveDaysAgo, $lt: sevenDaysAgo },
        role: { $ne: Role.ADMIN },
        isVerified: true,
        status: UserStatus.ACTIVE,
      });

      this.logger.log(`📧 Found ${usersForMotivation.length} users for motivational emails`);
      this.logger.log(`⚠️ Found ${usersToSuspend.length} users to suspend`);

      let motivationSuccessCount = 0;
      let motivationFailureCount = 0;
      let suspensionSuccessCount = 0;
      let suspensionFailureCount = 0;

      // Process suspensions first
      for (const user of usersToSuspend) {
        try {
          // Update user status to suspended
          await this.userRepo.findOneAndUpdate(
            { _id: user._id },
            {
              status: UserStatus.SUSPENDED,
              suspendedAt: new Date(),
              suspensionReason: 'Account suspended due to inactivity (65+ days)',
            }
          );

          // Send suspension notification email
          await this.sendSuspensionEmail(user);
          suspensionSuccessCount++;
          this.logger.debug(`⚠️ User suspended: ${user.email}`);
        } catch (error) {
          suspensionFailureCount++;
          this.logger.error(
            `❌ Failed to suspend user ${user.email}: ${error.message}`,
          );
        }

        // Add delay to avoid overwhelming email service
        await this.delay(300);
      }

      // Process motivational emails
      for (const user of usersForMotivation) {
        try {
          await this.sendMotivationalEmail(user);
          motivationSuccessCount++;
          this.logger.debug(`✉️ Email sent to: ${user.email}`);
        } catch (error) {
          motivationFailureCount++;
          this.logger.error(
            `❌ Failed to send email to ${user.email}: ${error.message}`,
          );
        }

        // Add small delay to avoid overwhelming email service
        await this.delay(300);
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      this.logger.log(`✅ Inactive user management job completed in ${duration}s`);
      this.logger.log(
        `📊 Results: ${motivationSuccessCount} motivation emails sent, ${motivationFailureCount} failed`,
      );
      this.logger.log(
        `📊 Suspensions: ${suspensionSuccessCount} successful, ${suspensionFailureCount} failed`,
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

  private async sendSuspensionEmail(user: any): Promise<void> {
    // Create suspension email template
    const suspensionEmail = this.suspensionEmailTemplate
      .replace(/{{userName}}/g, user.firstName || 'there')
      .replace(
        /{{supportUrl}}/g,
        process.env.FRONTEND_URL || 'https://englishom.com/contact',
      );

    // Prepare email data
    const mailOptions = {
      from: `"Englishom Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: '⚠️ Your Englishom Account Has Been Suspended - Contact Support',
      html: suspensionEmail,
    };

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
    this.logger.log('🔧 Manually triggering inactive user management job...');
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

  private getSuspensionEmailTemplate(): string {
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
            background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
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
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
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
            <div class="emoji">⚠️🔒</div>
            <h1>Account Suspended</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}},</p>
            
            <div class="warning-box">
                <strong>⚠️ Important Notice:</strong> Your Englishom account has been temporarily suspended due to extended inactivity (65+ days).
            </div>
            
            <p>We understand that life gets busy, and learning schedules can change. Your account suspension is temporary and can be easily reactivated!</p>
            
            <h3>🔄 How to Reactivate Your Account:</h3>
            <ul>
                <li>📞 Contact our support team</li>
                <li>💬 Use our live chat feature</li>
                <li>📧 Send us an email explaining your situation</li>
                <li>🌐 Visit our support center</li>
            </ul>
            
            <p><strong>Why was my account suspended?</strong></p>
            <p>Accounts are automatically suspended after 65 days of inactivity to maintain platform security and optimize our learning resources. This helps us ensure that active learners have the best experience possible.</p>
            
            <p><strong>Your Progress is Safe! 🛡️</strong></p>
            <p>Don't worry - all your progress, certificates, and course data are safely stored and will be restored once your account is reactivated.</p>
            
            <div style="text-align: center;">
                <a href="{{supportUrl}}" class="cta-button">Contact Support Now</a>
            </div>
            
            <p>We're here to help you get back to your English learning journey. Our support team is ready to assist you with account reactivation.</p>
            
            <p>Thank you for your understanding! 🙏</p>
            
            <p>Best regards,<br>
            <strong>The Englishom Team</strong></p>
        </div>
        <div class="footer">
            <p>© 2024 Englishom. Supporting English learners worldwide.</p>
            <p>If you believe this was sent in error, please contact our support team immediately.</p>
        </div>
    </div>
</body>
</html>
`;
  }
}

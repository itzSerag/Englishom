import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRepo } from '../user/repo/user.repo';
import { MailService } from '../common/mail/mail.service';
import { Role, UserStatus } from '../common/shared';
import { TimeService } from '../common/config/time.service';
import { EmailMessages } from '../common/shared/const';
import { UserProcessingResult } from './interface/user-proccessing-result.interface';
import { OrderRepo } from '../payment/repo/order.repo';

@Injectable()
export class InactiveUserCronService {
  private readonly logger = new Logger(InactiveUserCronService.name);
  private readonly emailTemplate: string;
  private readonly suspensionEmailTemplate: string;

  constructor(
    private readonly userRepo: UserRepo,
    private readonly emailService: MailService,
    private readonly timeService: TimeService,
    private readonly orderRepo: OrderRepo,
  ) {
      this.emailTemplate =this.getEmailTemplate();
      this.suspensionEmailTemplate = this.getSuspensionEmailTemplate();
  }

  /**
   * 
   * 5 AM every day, Riyadh time -- Traffic is low at this time
   * Sends motivational emails to users inactive for 7+ days
   * Suspends accounts inactive for 65+ days
   */


  

 @Cron(CronExpression.EVERY_DAY_AT_5AM, {
  name: 'check-inactive-users',
  timeZone: 'Asia/Riyadh',
})
@Cron(CronExpression.EVERY_DAY_AT_5AM, {
  name: 'check-inactive-users',
  timeZone: 'Asia/Riyadh',
})
async handleInactiveUsers() {
  const startTime = this.timeService.createDate();
  this.logger.log('🔄 Starting inactive user management job...');

  try {
    // Configuration
    const BATCH_SIZE = 50; // Process 50 users in parallel
    const BATCH_DELAY_MS = 1000; // 1 second between batches
    const EMAIL_DELAY_MS = 100; // 100ms between individual emails

    // 65 days ago (for suspension)
    const sixtyFiveDaysAgo = new Date(
      startTime.getTime() - 65 * 24 * 60 * 60 * 1000,
    );

    // Find all users inactive for up to 65+ days
    const inactiveUsers = await this.userRepo.find({
      lastActivity: { $lt: startTime, $gte: sixtyFiveDaysAgo },
      role: { $ne: Role.ADMIN },
      isVerified: true,
      status: UserStatus.ACTIVE,
    });

    this.logger.log(`📊 Found ${inactiveUsers.length} inactive users to check`);

    let motivationSuccessCount = 0;
    let motivationFailureCount = 0;
    let suspensionSuccessCount = 0;
    let suspensionFailureCount = 0;

    // Process users in batches
    for (let i = 0; i < inactiveUsers.length; i += BATCH_SIZE) {
      const batch = inactiveUsers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(inactiveUsers.length / BATCH_SIZE);
      
      this.logger.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);

      // Process current batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (user) => {
          const userResult = await this.processSingleUser(user);
          
          // Small delay between email sends within the same batch
          if (userResult.sentEmail) {
            await this.delay(EMAIL_DELAY_MS);
          }
          
          return userResult;
        })
      );


      // Count results from this batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const userResult = result.value;
          if (userResult.motivation?.success) motivationSuccessCount++;
          if (userResult.motivation?.failure) motivationFailureCount++;
          if (userResult.suspension?.success) suspensionSuccessCount++;
          if (userResult.suspension?.failure) suspensionFailureCount++;
        } else {
          // If the entire user processing failed, count it as both motivation and suspension failure
          motivationFailureCount++;
          suspensionFailureCount++;
          this.logger.error(`❌ Failed to process user in batch: ${('' + (result as any).reason)}`);
        }
      }

      // Delay between batches (but not after the last batch)
      if (i + BATCH_SIZE < inactiveUsers.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }

    const endTime = this.timeService.createDate();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    this.logger.log(`✅ Inactive user job completed in ${duration}s`);
    this.logger.log(
      `📧 Motivation: ${motivationSuccessCount} sent, ${motivationFailureCount} failed`,
    );
    this.logger.log(
      `⚠️ Suspensions: ${suspensionSuccessCount} done, ${suspensionFailureCount} failed`,
    );

    // Log performance summary
    const totalProcessed = motivationSuccessCount + motivationFailureCount + suspensionSuccessCount + suspensionFailureCount;
    const successRate = totalProcessed > 0 
      ? ((motivationSuccessCount + suspensionSuccessCount) / totalProcessed * 100).toFixed(1)
      : '0';
    this.logger.log(`📊 Overall success rate: ${successRate}%`);

  } catch (error) {
    this.logger.error(`💥 Error in inactive user job: ${error.message}`);
  }
}


  /**
 * Process a single user and determine what action to take
 */
private async processSingleUser(user: any): Promise<UserProcessingResult> {
  const now = this.timeService.createDate();
  const diffInDays = Math.floor(
    (now.getTime() - new Date(user.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
  );

  const result: UserProcessingResult = {
    sentEmail: false,
    motivation: null,
    suspension: null
  };

  // --- Suspension check (>= 65 days) ---
  if (diffInDays >= 65) {
    try {
      await this.userRepo.findOneAndUpdate(
        { _id: user._id },
        {
          status: UserStatus.SUSPENDED,
          suspendedAt: now,
          suspensionReason: EmailMessages.SuspensionReasonMessage,
        },
      );

      await this.sendSuspensionEmail(user);
      result.suspension = { success: true };
      result.sentEmail = true;
      this.logger.debug(`⚠️ User suspended: ${user.email}`);
    } catch (error) {
      result.suspension = { failure: true, error: error.message };
      this.logger.error(`❌ Failed to suspend ${user.email}: ${error.message}`);
    }
    return result;
  }

  // --- Motivational email check (every 7 days: 7, 14, 21...) ---
  if (diffInDays > 0 && diffInDays % 7 === 0 ) {
    try {
      await this.sendMotivationalEmail(user);
      result.motivation = { success: true };
      result.sentEmail = true;
      this.logger.debug(`✉️ Motivational email sent to: ${user.email}`);
    } catch (error) {
      result.motivation = { failure: true, error: error.message };
      this.logger.error(`❌ Failed to send email to ${user.email}: ${error.message}`);
    }
  }

  return result;
}



  private async sendMotivationalEmail(user: any): Promise<void> {
    // Compute remaining days for latest purchased level (simple heuristic)
    let daysLeftText = 'some days';
    try {
      const { LevelAccessService } = await import('../common/services/level-access.service');
      const { OrderRepo } = await import('../payment/repo/order.repo');
      // Manually construct service to keep change minimal
      const orderRepo = (this as any).orderRepo instanceof OrderRepo ? (this as any).orderRepo : null;
      const accessService = new LevelAccessService(orderRepo as any);
      const info = await accessService.getLatestAccessInfo(user._id.toString());
      if (info) {
        daysLeftText = `${info.daysLeft} days`;
      }
    } catch (e) {
      // Fallback silently if repo not available in this context
    }

    const personalizedEmail = this.emailTemplate
      .replaceAll('{{userName}}', user.firstName || 'there')
      .replaceAll('{{daysLeft}}', daysLeftText)
      .replaceAll(
        '{{loginUrl}}',
        process.env.FRONTEND_URL || 'https://englishom.com/login',
      );

    const mailOptions = {
      to: user.email,
      subject: EmailMessages.weMissYouMessage,
      htmlContent: personalizedEmail,
    };

    await this.sendCustomEmail(mailOptions);
  }

  private async sendSuspensionEmail(user: any): Promise<void> {
    // Create suspension email template
    const suspensionEmail = this.suspensionEmailTemplate
      .replaceAll('{{userName}}', user.firstName || 'there')
      .replaceAll(
        '{{supportUrl}}',
        process.env.FRONTEND_URL || 'https://englishom.com/contact',
      );

    // Prepare email data
    const mailOptions = {
      to: user.email,
      subject: EmailMessages.AccountSuspendedMessage,
      htmlContent: suspensionEmail,
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

  

 
  private getEmailTemplate(): string {
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
            <p><strong>Heads up:</strong> You have {{daysLeft}} left in your current level access.</p>
            
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

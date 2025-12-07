import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRepo } from '../user/repo/user.repo';
import { MailService } from '../common/mail/mail.service';
import { Role, UserStatus } from '../common/shared';
import { TimeService } from '../common/config/time.service';
import { EmailMessages } from '../common/shared/const';
import { UserProcessingResult } from './interface/user-proccessing-result.interface';
import { LevelAccessService } from '../common/services/level-access.service'; // FIXED: Import properly
import { ClusterHelper } from '../common/services/cluster-helper.service';

@Injectable()
export class InactiveUserCronService {
  private readonly logger = new Logger(InactiveUserCronService.name);
  private readonly emailTemplate: string;
  private readonly suspensionEmailTemplate: string;
  
  private readonly BATCH_SIZE = 100;
  private readonly DB_BATCH_DELAY_MS = 2000; // 2 seconds between DB batches
  private readonly EMAIL_DELAY_MS = 100; // 100ms between emails
  private readonly EMAIL_RETRY_COUNT = 3;

  constructor(
    private readonly userRepo: UserRepo,
    private readonly emailService: MailService,
    private readonly timeService: TimeService,
    private readonly levelAccessService: LevelAccessService, // FIXED: Inject properly
    private readonly clusterHelper: ClusterHelper, // PREVENT CRON JOB INTERFERENCE
  ) {
    this.emailTemplate = this.getEmailTemplate();
    this.suspensionEmailTemplate = this.getSuspensionEmailTemplate();
  }

  /**
   * 5 AM every day, Riyadh time
   * Sends motivational emails to users inactive for 7+ days
   * Suspends accounts inactive for 65+ days
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM, {
    name: 'check-inactive-users',
    timeZone: 'Asia/Riyadh',
  })
  async handleInactiveUsers() {


    // inverted check to exit early
    if(!this.clusterHelper.isPrimary()) {
      this.logger.log('Skipping check-inactive-users job on non-primary instance');
      return;
    }

    const startTime = this.timeService.createDate();
    this.logger.log('🔄 Starting inactive user management job...');

    try {
      // Calculate dates correctly
      const now = startTime;
      const sixtyFiveDaysAgo = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Stats tracking
      const stats = {
        motivationSuccess: 0,
        motivationFailure: 0,
        suspensionSuccess: 0,
        suspensionFailure: 0,
        totalProcessed: 0,
        dbQueries: 0,
      };

      // Process in batches to prevent memory issues
      let skip = 0;
      let hasMoreUsers = true;

      while (hasMoreUsers) {
        stats.dbQueries++;
        
        // Get batch of users
        const allInactiveUsers = await this.userRepo.find({
          lastActivity: { $lt: sevenDaysAgo }, // Inactive for 7+ days
          role: { $ne: Role.ADMIN },
          isVerified: true,
          status: UserStatus.ACTIVE,
        });

        const users = allInactiveUsers
          .sort((a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()) // Process oldest first
          .slice(skip, skip + this.BATCH_SIZE);

        if (users.length === 0) {
          hasMoreUsers = false;
          break;
        }

        this.logger.log(`📊 Processing batch ${Math.floor(skip/this.BATCH_SIZE) + 1} (${users.length} users)`);

        // Process batch
        for (const user of users) {
          stats.totalProcessed++;
          const result = await this.processSingleUser(user, now, sixtyFiveDaysAgo);
          
          // Update stats
          if (result.motivation?.success) stats.motivationSuccess++;
          if (result.motivation?.failure) stats.motivationFailure++;
          if (result.suspension?.success) stats.suspensionSuccess++;
          if (result.suspension?.failure) stats.suspensionFailure++;
          
          // Rate limiting between emails
          if (result.sentEmail) {
            await this.delay(this.EMAIL_DELAY_MS);
          }
        }

        skip += this.BATCH_SIZE;
        
        // Rate limiting between database batches
        if (hasMoreUsers) {
          await this.delay(this.DB_BATCH_DELAY_MS);
        }
      }

      // Log completion
      const duration = (Date.now() - startTime.getTime()) / 1000;
      this.logger.log(`✅ Job completed in ${duration.toFixed(2)}s`);
      this.logger.log(`📊 Database queries: ${stats.dbQueries}`);
      this.logger.log(`👥 Total users processed: ${stats.totalProcessed}`);
      this.logger.log(`📧 Motivation emails: ${stats.motivationSuccess} sent, ${stats.motivationFailure} failed`);
      this.logger.log(`⚠️ Suspensions: ${stats.suspensionSuccess} successful, ${stats.suspensionFailure} failed`);
      
      if (stats.totalProcessed > 0) {
        const successRate = ((stats.motivationSuccess + stats.suspensionSuccess) / 
                           stats.totalProcessed * 100).toFixed(1);
        this.logger.log(`🎯 Success rate: ${successRate}%`);
      }

    } catch (error) {
      this.logger.error(`💥 Critical error in inactive user job: ${error.message}`);
      this.logger.error(error.stack);
    }
  }

  /**
   * Process a single user
   */
  private async processSingleUser(
    user: any, 
    now: Date, 
    sixtyFiveDaysAgo: Date
  ): Promise<UserProcessingResult> {
    const userLastActivity = new Date(user.lastActivity);
    const diffInDays = Math.floor(
      (now.getTime() - userLastActivity.getTime()) / (1000 * 60 * 60 * 24)
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
        this.logger.debug(`⚠️ User suspended: ${user.email} (${diffInDays} days inactive)`);
      } catch (error) {
        result.suspension = { failure: true, error: error.message };
        this.logger.error(`❌ Failed to suspend ${user.email}: ${error.message}`);
      }
      return result;
    }

    // --- Motivational email check (every 7 days) ---
    if (diffInDays >= 7 && diffInDays % 7 === 0) {
      try {
        await this.sendMotivationalEmail(user);
        result.motivation = { success: true };
        result.sentEmail = true;
        this.logger.debug(`✉️ Motivational email sent to: ${user.email} (${diffInDays} days inactive)`);
      } catch (error) {
        result.motivation = { failure: true, error: error.message };
        this.logger.error(`❌ Failed to send email to ${user.email}: ${error.message}`);
      }
    }

    return result;
  }

  private async sendMotivationalEmail(user: any): Promise<void> {
    let daysLeftText = 'some days';
    
    try {
      const info = await this.levelAccessService.getLatestAccessInfo(user._id.toString());
      if (info && info.daysLeft > 0) {
        daysLeftText = `${info.daysLeft} days`;
      }
    } catch (error) {
      this.logger.warn(`Could not get level access info for ${user.email}: ${error.message}`);
    }

    const personalizedEmail = this.emailTemplate
      .replaceAll('{{userName}}', user.firstName || 'there')
      .replaceAll('{{daysLeft}}', daysLeftText)
      .replaceAll(
        '{{loginUrl}}',
        process.env.FRONTEND_URL || 'https://englishom.com/login',
      );

    await this.sendEmailWithRetry({
      to: user.email,
      subject: EmailMessages.weMissYouMessage,
      htmlContent: personalizedEmail,
    });
  }

  private async sendSuspensionEmail(user: any): Promise<void> {
    const suspensionEmail = this.suspensionEmailTemplate
      .replaceAll('{{userName}}', user.firstName || 'there')
      .replaceAll(
        '{{supportUrl}}',
        process.env.FRONTEND_URL || 'https://englishom.com/contact',
      );

    await this.sendEmailWithRetry({
      to: user.email,
      subject: EmailMessages.AccountSuspendedMessage,
      htmlContent: suspensionEmail,
    });
  }

  private async sendEmailWithRetry(
    mailOptions: any, 
    retries = this.EMAIL_RETRY_COUNT
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.emailService.sendCustomEmail(mailOptions);
        return;
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
        }
        await this.delay(1000 * attempt); // Exponential backoff
      }
    }
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

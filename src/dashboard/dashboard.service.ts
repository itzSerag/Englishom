import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { UserRepo } from '../user/repo/user.repo';
import { OrderRepo } from '../payment/repo/order.repo';
import { CourseRepo } from '../auth/repo/course.repo';
import { PaymentStatus } from '../payment/types';
import { UserStatus } from '../common/shared/enums';
import {
  DashboardPaginationDto,
  DashboardSearchDto,
  AssignCourseDto,
} from './dto';
import { TransactionService } from '../common/database/transaction.service';
import {
  cleanResponse,
  cleanResponseArray,
} from '../common/utils/response.utils';
import { User } from '../user/models/user.schema';
import { EmailService } from '../common/mail/mail.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private courseAssignmentEmailTemplate: string;

  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderRepo: OrderRepo,
    private readonly courseRepo: CourseRepo,
    private readonly transactionService: TransactionService,
    private readonly emailService: EmailService,
  ) {
    this.loadCourseAssignmentEmailTemplate();
  }

  /**
   * Get comprehensive dashboard statistics
   * Only accessible by SUPER and MANAGER admins
   */
  async getDashboardStats() {
    try {
      this.logger.log('Generating dashboard statistics...');

      // Run all statistics queries in parallel for better performance
      const [
        totalUsers,
        totalActiveUsers,
        totalSuspendedUsers,
        totalBlockedUsers,
        totalRevenue,
        totalSubscribedUsers,
        totalCourses,
        recentOrders,
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getTotalActiveUsers(),
        this.getTotalSuspendedUsers(),
        this.getTotalBlockedUsers(),
        this.getTotalRevenue(),
        this.getTotalSubscribedUsers(),
        this.getTotalCourses(),
        this.getRecentOrders(),
      ]);

      const stats = {
        overview: {
          totalUsers,
          totalActiveUsers,
          totalSuspendedUsers,
          totalBlockedUsers,
          totalRevenue,
          totalSubscribedUsers,
          totalCourses,
        },
        recentActivity: {
          recentOrders,
        },
        generatedAt: new Date(),
      };

      this.logger.log('Dashboard statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error(
        `Error generating dashboard stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Assign a course to a user manually (for cash payments or admin actions)
   * Only accessible by SUPER and MANAGER admins
   */
  async assignCourseToUser(assignCourseDto: AssignCourseDto) {
    return await this.transactionService.withTransaction(async (session) => {
      const { userId, levelName, reason } = assignCourseDto;

      this.logger.log(
        `Assigning course ${levelName} to user ${userId}. Reason: ${reason || 'Not specified'}`,
      );

      // Check if user exists
      const user: User = await this.userRepo.findOne({ _id: userId }, session);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot assign course to user with status: ${user.status}`,
        );
      }

      // Check if course exists
      const course = await this.courseRepo.findByLevelName(levelName);
      if (!course) {
        throw new NotFoundException(`Course with level ${levelName} not found`);
      }

      // Check if user already has this course completed
      const existingCompletedOrder = await this.orderRepo.findCompletedOrder(
        userId,
        levelName,
        session,
      );

      if (existingCompletedOrder) {
        throw new BadRequestException(
          `User already has access to ${levelName} level`,
        );
      }

      // Create a completed order record for the user
      const order = await this.orderRepo.create(
        {
          userId: user._id as any,
          levelName: levelName,
          amountCents: course.price * 100, // Convert to cents
          paymentStatus: PaymentStatus.COMPLETED,
          paymentDate: new Date(),
          paymentId: `ADMIN_ASSIGNED_${Date.now()}`, // Special payment ID to indicate admin assignment
        },
        session,
      );

      this.logger.log(
        `Successfully assigned course ${levelName} to user ${userId}. Order ID: ${order._id}`,
      );

      // Send course assignment email
      await this.sendCourseAssignmentEmail(user, levelName, reason);

      return {
        message: `Course ${levelName} successfully assigned to user`,
        order: {
          _id: order._id.toString(),
          levelName: order.levelName,
          assignedAt: order.paymentDate,
          reason: reason || 'Admin assignment',
        },
        user: cleanResponse(user),
      };
    });
  }

  /**
   * Get user details for course assignment
   */
  async getUserDetails(userId: string) {
    try {
      const user = await this.userRepo.findOne({ _id: userId });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get user's completed orders
      const completedOrders = await this.orderRepo.find({
        userId: userId,
        paymentStatus: PaymentStatus.COMPLETED,
      });

      return {
        user: cleanResponse(user),
        completedCourses: (completedOrders || []).map((order) => ({
          levelName: order.levelName,
          purchaseDate: order.createdAt || order.paymentDate,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user details: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get paginated list of users for dashboard
   * Access: SUPER and MANAGER only
   */
  async getPaginatedUsers(paginationDto: DashboardPaginationDto) {
    try {
      const result = await this.userRepo.findWithPagination(
        {},
        paginationDto.page,
        paginationDto.limit,
      );

      return {
        users: cleanResponseArray(result.data),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching paginated users: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Search users with proper pagination
   * Uses the repository's pagination method for consistency
   */
  async searchUsers(searchDto: DashboardSearchDto) {
    try {
      const { query, page, limit } = searchDto;

      // If no query provided, return all users within the page and limit
      if (!query || query.trim() === '') {
        return await this.getPaginatedUsers({ page, limit });
      }

      // Create regex for case-insensitive search
      const searchRegex = new RegExp(query.trim(), 'i');

      // Build search filter using OR logic across email, firstName, and lastName
      const finalFilter = {
        $or: [
          { email: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex }
        ]
      };

      // Use the repository's pagination method
      const result = await this.userRepo.findWithPagination(
        finalFilter,
        page,
        limit,
      );

      return {
        users: cleanResponseArray(result.data),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      this.logger.error(`Error searching users: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods for statistics - optimized for performance
  private async getTotalUsers(): Promise<number> {
    return await this.userRepo.countDocuments({});
  }

  private async getTotalActiveUsers(): Promise<number> {
    return await this.userRepo.countDocuments({ status: UserStatus.ACTIVE });
  }

  private async getTotalSuspendedUsers(): Promise<number> {
    return await this.userRepo.countDocuments({ status: UserStatus.SUSPENDED });
  }

  private async getTotalBlockedUsers(): Promise<number> {
    return await this.userRepo.countDocuments({ status: UserStatus.BLOCKED });
  }

  private async getTotalRevenue(): Promise<number> {
    const orders = await this.orderRepo.find({
      paymentStatus: PaymentStatus.COMPLETED,
    });
    if (!orders) return 0;

    return orders.reduce((total, order) => total + order.amountCents / 100, 0);
  }

  private async getTotalSubscribedUsers(): Promise<number> {
    const orders = await this.orderRepo.find({
      paymentStatus: PaymentStatus.COMPLETED,
    });

    if (!orders || orders.length === 0) return 0;

    // Get unique user IDs from the orders
    const uniqueUserIds = [
      ...new Set(orders.map((order) => order.userId.toString())),
    ];

    // Now check which of these users actually exist in the User collection
    const existingUsers = await this.userRepo.find({
      _id: { $in: uniqueUserIds },
    });

    return existingUsers.length;
  }

  private async getTotalCourses(): Promise<number> {
    const courses = await this.courseRepo.find({});
    return courses ? courses.length : 0;
  }

  private async getRecentOrders(limit: number = 10) {
    const orders = await this.orderRepo.find({
      paymentStatus: PaymentStatus.COMPLETED,
    });
    if (!orders) return [];

    return cleanResponseArray(orders)
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.paymentDate).getTime() -
          new Date(a.createdAt || a.paymentDate).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Load course assignment email template
   */
  private loadCourseAssignmentEmailTemplate(): void {
    try {
      // Try to load from payment template directory first, since it's similar
      const templatePath = path.join(
        __dirname,
        '..',
        'payment',
        'templates',
        'payment-success-email-template.html',
      );
      this.courseAssignmentEmailTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      this.logger.warn(
        'Failed to load course assignment email template, using fallback template',
      );
      this.courseAssignmentEmailTemplate = this.getFallbackCourseAssignmentTemplate();
    }
  }

  /**
   * Get fallback course assignment email template
   */
  private getFallbackCourseAssignmentTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .success-box { background: #d4edda; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Course Assigned!</h1>
          </div>
          <div class="content">
            <p>Hi {{userName}},</p>
            <div class="success-box">
              <strong>Great news!</strong> You have been granted access to a new course level.
            </div>
            <p><strong>Level:</strong> {{levelName}}</p>
            <p><strong>Assigned by:</strong> Englishom Team</p>
            <p><strong>Reason:</strong> {{reason}}</p>
            <p>You can now access all materials for this level!</p>
            <p>Best regards,<br>The Englishom Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send course assignment email to user
   */
  private async sendCourseAssignmentEmail(
    user: any,
    levelName: string,
    reason: string,
  ): Promise<void> {
    try {
      // Replace template variables
      const personalizedEmail = this.courseAssignmentEmailTemplate
        .replace(/{{userName}}/g, user.firstName || 'there')
        .replace(/{{levelName}}/g, levelName)
        .replace(/{{reason}}/g, reason || 'Admin assignment')
        .replace(/{{amount}}/g, 'Complimentary') // Since this is admin assignment
        .replace(/{{paymentDate}}/g, new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }))
        .replace(/{{orderId}}/g, `ADMIN_${Date.now()}`)


      // Prepare email data
      const mailOptions = {
        from: `"Englishom Team" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `🎉 Course Access Granted - Welcome to ${levelName} Level!`,
        html: personalizedEmail,
      };

      await this.emailService.sendCustomEmail(mailOptions);
      this.logger.log(
        `Course assignment email sent to ${user.email} for level ${levelName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send course assignment email to ${user.email}: ${error.message}`,
        error.stack,
      );
      // Don't throw error to avoid breaking the assignment flow
    }
  }

  // private async getRevenueByMonth() {
  //   const sixMonthsAgo = new Date();
  //   sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  //   const orders = await this.orderRepo.find({
  //     paymentStatus: PaymentStatus.COMPLETED,
  //     createdAt: { $gte: sixMonthsAgo }
  //   });

  //   if (!orders) return [];

  //   // Group orders by month
  //   const monthlyData = new Map();

  //   orders.forEach(order => {
  //     const createdAt = order.createdAt || order.paymentDate;
  //     const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`;

  //     if (!monthlyData.has(monthKey)) {
  //       monthlyData.set(monthKey, {
  //         _id: {
  //           year: createdAt.getFullYear(),
  //           month: createdAt.getMonth() + 1
  //         },
  //         revenue: 0,
  //         orders: 0
  //       });
  //     }

  //     const data = monthlyData.get(monthKey);
  //     data.revenue += order.amountCents;
  //     data.orders++;
  //   });

  //   return Array.from(monthlyData.values()).sort((a, b) =>
  //     a._id.year - b._id.year || a._id.month - b._id.month
  //   );
  // }
}

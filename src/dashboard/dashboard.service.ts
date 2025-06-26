import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
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

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderRepo: OrderRepo,
    private readonly courseRepo: CourseRepo,
    private readonly transactionService: TransactionService,
  ) {}

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

      return {
        success: true,
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
      const { email, firstName, lastName, page = 1, limit = 10 } = searchDto;

      // Validate that at least one search parameter is provided
      if (!email && !firstName && !lastName) {
        // if nothing provided, return all wihin the page and the limit
        return await this.getPaginatedUsers({ page, limit });
      }

      // Build search filter
      const searchFilters = [];

      // Specific field searches
      if (email) {
        const emailRegex = new RegExp(email.trim(), 'i');
        searchFilters.push({ email: emailRegex });
      }

      if (firstName) {
        const firstNameRegex = new RegExp(firstName.trim(), 'i');
        searchFilters.push({ firstName: firstNameRegex });
      }

      if (lastName) {
        const lastNameRegex = new RegExp(lastName.trim(), 'i');
        searchFilters.push({ lastName: lastNameRegex });
      }

      // Combine all filters with AND logic
      const finalFilter =
        searchFilters.length > 1 ? { $and: searchFilters } : searchFilters[0];

      // Use the repository's pagination method
      const result = await this.userRepo.findWithPagination(
        finalFilter,
        page,
        limit,
      );

      return {
        users: cleanResponseArray(result.data),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
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

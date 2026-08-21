import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRepo } from './repo/user.repo';
import * as bcrypt from 'bcrypt';
import { OrderService } from '../common/shared/services/order.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Level_Name } from '../common/shared/enums';
import { log } from 'console';
import { CompleteLevelDto } from './dto/complete-level.dto';
import { CertificateRepo } from './repo/certificate.repo';
import { Types } from 'mongoose';
import { GetCertificateDto } from './dto/get-certificate';
import { PaginationDto } from './dto/pagination.dto';
import { IpService } from '../common/services/ip.service';
import { User } from './models/user.schema';
import { Admin } from '../admin/models/admin.schema';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserStatus } from '../common/shared';
import { OrderRepo } from '../payment/repo/order.repo';
import { CourseRepo } from '../course/repo/course.repo';
import { cleanResponse } from '../common/utils/response.utils';
import { TimeService } from '../common/config/time.service';
import { LevelAccessService } from '../common/services/level-access.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderService: OrderService,
    private readonly certificateRepo: CertificateRepo,
    private readonly ipService: IpService,
    private readonly orderRepo: OrderRepo,
    private readonly courseRepo: CourseRepo,
    private readonly timeService: TimeService,
    private readonly levelAccessService: LevelAccessService,
  ) {}

  private readonly logger = new Logger(UserService.name);

  async create(createUserDto: CreateUserDto) {
    const user = await this.userRepo.findOne({ email: createUserDto.email });
    if (user) {
      return null;
    }

    // hash password -- 10 is a constant
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    createUserDto.password = hashedPassword;

    // Set country based on IP address during signup
    if (createUserDto.ipAddress) {
      const country = await this.ipService.getCountryFromIp(
        createUserDto.ipAddress,
      );
      createUserDto.country = country;
    }
    log('ipAddress', createUserDto.ipAddress);
    log('createUserDto country', createUserDto.country);

    return await this.userRepo.create({ ...createUserDto });
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({ email });
  }

  async findById(id: string) {
    return this.userRepo.findOne({ _id: id });
  }

  async findAll() {
    return await this.userRepo.find({});
  }

  async findAllWithPagination(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;
    return await this.userRepo.findWithPagination({}, page, limit);
  }

  async findByStatus(status: UserStatus, paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;
    return await this.userRepo.findWithPagination({ status }, page, limit);
  }

  async deleteUser(_id: string) {
    return await this.userRepo.findOneAndDelete({ _id });
  }

  async findOneAndUpdate(_id: string, updateUserDto: UpdateUserDto) {
    return await this.userRepo.findOneAndUpdate({ _id }, updateUserDto);
  }

  async getUserCertificate(userId: string, certificateDto: GetCertificateDto) {
    const certificate = await this.certificateRepo.findOne({
      userId: new Types.ObjectId(userId),
      level_name: certificateDto.level_name,
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  async resetPassword(user: User | Admin, restPasswordDto: ResetPasswordDto) {
    // hash the new password
    const { newPassword, oldPassword } = restPasswordDto;
    //compare the old password and new password

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      { password: hashedPassword },
    );
  }

  async getUserCompletedOrders(userId: string) {
    const userLevels = await this.orderService.findUserCompletedOrders(userId);
    return userLevels;
  }

  async getUserCompletedLevelNames(userId: string) {
    const userLevels = await this.orderService.findUserCompletedOrders(userId);
    // i want the levelnames only
    const levelNames = userLevels.map((level) => level.levelName);
    return levelNames;
  }

  async getCompletedDaysInLevel(userId: string, levelName: Level_Name) {
    const userLevels = await this.getUserCompletedLevelNames(userId);
    log('userLevels', userLevels);
    // if level name not included within userLevels throw an error
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    return await this.userRepo.userProgress(userId, levelName);
  }

  async markLevelAsCompleted(
    userId: string,
    completeLevelDto: CompleteLevelDto,
  ) {
    const userLevels = await this.getUserCompletedLevelNames(userId);

    if (!userLevels.includes(completeLevelDto.level_name)) {
      throw new NotFoundException('User does not have this level');
    }

    // Simple rule: User must have completed day 50
    const completedDays = await this.getCompletedDaysInLevel(
      userId.toString(),
      completeLevelDto.level_name,
    );

    if (completedDays < 50) {
      throw new BadRequestException(
        `You have to finish day 50 to complete this level. Currently completed: day ${completedDays}`,
      );
    }

    // ISSUE THE CERTIFICATE
    const isCertificateExist = await this.certificateRepo.findOne({
      // WHEN COMBINED FILTER ID MUST RETURNED TO OBJECT

      userId: new Types.ObjectId(userId),
      level_name: completeLevelDto.level_name,
    });

    log('isCertificateExist', isCertificateExist);

    if (isCertificateExist) {
      throw new NotFoundException('User already completed this level');
    }

    const certificate = await this.certificateRepo.create({
      userId: new Types.ObjectId(userId),
      level_name: completeLevelDto.level_name,
      certificateId: this.generateCertificateId(),
    });

    return certificate;
  }

  private async checkAndAutoCompleteLevelIfNeeded(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
  ) {
    try {
      // Simple rule: If user completes day 50, they complete the whole level
      if (dayNumber === 50) {
        // Check if certificate already exists
        const isCertificateExist = await this.certificateRepo.findOne({
          userId: new Types.ObjectId(userId),
          level_name: levelName,
        });

        if (!isCertificateExist) {
          // Auto-issue certificate
          await this.certificateRepo.create({
            userId: new Types.ObjectId(userId),
            level_name: levelName,
            certificateId: this.generateCertificateId(),
          });

          this.logger.log(
            `Auto-completed level ${levelName} for user ${userId} after completing day 50`,
          );
        }
      }
    } catch (error) {
      // Don't throw error to avoid breaking the day completion process
      this.logger.error(
        `Error in auto-completion check for user ${userId}, level ${levelName}: ${error.message}`,
      );
    }
  }

  async markDayAsCompleted(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
  ) {
    const userLevels = await this.getUserCompletedLevelNames(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    // check if the day is already completed or its not available to complete
    const completedDays = await this.getCompletedDaysInLevel(userId, levelName);

    if (dayNumber > completedDays + 1) {
      throw new NotFoundException('You can only complete the next day');
    }

    // Mark the day as completed
    const result = await this.userRepo.markDayAsCompleted(
      userId,
      levelName,
      dayNumber,
    );

    // Check if user has completed day 50 for auto-completion
    await this.checkAndAutoCompleteLevelIfNeeded(userId, levelName, dayNumber);

    return result;
  }

  async markTaskAsCompleted(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
    taskName: string,
  ) {
    const userLevels = await this.getUserCompletedLevelNames(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    // check if the day is already completed or its not available to complete
    const completedDays = await this.getCompletedDaysInLevel(userId, levelName);

    if (dayNumber > completedDays + 1) {
      throw new NotFoundException(
        'You can only complete tasks in the next day',
      );
    }

    return await this.userRepo.markTaskAsCompleted(
      userId,
      levelName,
      dayNumber,
      taskName,
    );
  }

  async getCompletedTasksInDay(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
  ) {
    const userLevels = await this.getUserCompletedLevelNames(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    return await this.userRepo.getCompletedTasksInDay(
      userId,
      levelName,
      dayNumber,
    );
  }

  private generateCertificateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 14; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
    return result;
  }

  /**
   * Update user status (suspend, activate, block)
   * Only accessible by SUPER and MANAGER admins
   */
  async updateUserStatus(
    userId: string,
    updateStatusDto: UpdateUserStatusDto,
  ): Promise<User> {
    const user = await this.userRepo.findOne({ _id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      status: updateStatusDto.status,
    };

    // with defualt messages
    if (updateStatusDto.status === UserStatus.BLOCKED) {
      updateData.suspendedAt = this.timeService.createDate();
      updateData.suspensionReason =
        updateStatusDto.reason || 'Account blocked by admin';
    } else if (updateStatusDto.status === UserStatus.SUSPENDED) {
      updateData.suspendedAt = this.timeService.createDate();
      updateData.suspensionReason =
        updateStatusDto.reason || 'Account suspended by admin';
    } else if (updateStatusDto.status === UserStatus.ACTIVE) {
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
    }

    const updatedUser = await this.userRepo.findOneAndUpdate(
      { _id: userId },
      updateData,
    );

    this.logger.log(
      `User ${user.email} status updated to ${updateStatusDto.status}`,
    );

    return updatedUser;
  }

  /**
   * Suspend a user
   */
  async suspendUser(userId: string, reason?: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.SUSPENDED,
      reason: reason || 'Account suspended due to inactivity (65+ days)',
    });
  }

  /**
   * Activate a user
   */
  async activateUser(userId: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.ACTIVE,
    });
  }

  /**
   * Block a user permanently
   */
  async blockUser(userId: string, reason?: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.BLOCKED,
      reason: reason || 'Account blocked by admin',
    });
  }

  /**
   * Get users by status with pagination - optimized
   */
  async getUsersByStatus(status: UserStatus, paginationDto: PaginationDto) {
    // Use the repository's efficient pagination method
    return await this.userRepo.findWithPagination(
      { status },
      paginationDto.page,
      paginationDto.limit,
    );
  }

  async getUserDetails(userId: string) {
    try {
      const user = await this.userRepo.findOne({ _id: userId });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get user's completed orders
      const completedOrders =
        await this.orderRepo.findUserCompletedOrders(userId);

      // If user has no completed orders, return empty levels details
      if (!completedOrders || completedOrders.length === 0) {
        return {
          user: cleanResponse(user),
          levelsDetails: [],
        };
      }

      // Get unique level names from completed orders
      const purchasedLevelNames = [
        ...new Set(completedOrders.map((order) => order.levelName)),
      ];

      // Get course details for only purchased levels
      const purchasedCourses = await this.courseRepo.find({
        level_name: { $in: purchasedLevelNames },
      });

      // Build detailed level information for purchased courses only
      const levelsDetails = await Promise.all(
        purchasedCourses.map(async (course) => {
          const levelName = course.level_name;

          let currentDay = 0;
          let isCompleted = false;

          // Get user's current progress (highest completed day + 1, max 50)
          try {
            const completedDays = await this.userRepo.userProgress(
              userId,
              levelName,
            );
            if (completedDays !== null) {
              // Cap currentDay at 50 (max day available)
              currentDay = Math.min(completedDays + 1, 50);
            } else {
              currentDay = 1; // Start at day 1 if no progress
            }
          } catch (error) {
            this.logger.warn(
              `Failed to get progress for user ${userId} in level ${levelName}: ${error.message}`,
            );
            currentDay = 1; // Default to day 1 if there's an error
          }

          // Check if user has completed this level (has certificate)
          try {
            const certificate = await this.certificateRepo.findOne({
              userId: user._id,
              level_name: levelName,
            });
            isCompleted = !!certificate;
          } catch (error) {
            this.logger.warn(
              `Failed to check certificate for user ${userId} in level ${levelName}: ${error.message}`,
            );
            isCompleted = false;
          }

          // Get level access details (purchase date, expiry, days left)
          const accessInfo = await this.levelAccessService.getLatestAccessInfo(
            userId,
            levelName,
          );

          return {
            levelName,
            currentDay,
            isCompleted,
            purchaseDate: accessInfo?.purchaseDate || null,
            expiresAt: accessInfo?.expiresAt || null,
            daysLeft: accessInfo?.daysLeft || 0,
            isExpired: accessInfo?.isExpired || false,
          };
        }),
      );

      return {
        user: cleanResponse(user),
        levelsDetails, // Purchased courses details only
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user details: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getLevelAccessDetails(userId: string, levelName?: Level_Name) {
    // If specific level requested, return concise info for that level
    if (levelName) {
      const info = await this.levelAccessService.getLatestAccessInfo(
        userId,
        levelName,
      );
      if (!info) {
        return { hasPurchase: false };
      }
      return {
        hasPurchase: true,
        levelName: info.levelName,
        purchaseDate: info.purchaseDate,
        expiresAt: info.expiresAt,
        daysLeft: info.daysLeft,
        isExpired: info.isExpired,
      };
    }

    // Otherwise return details for all user purchases (grouped by level)
    const accessInfos = await this.levelAccessService.getAllAccessInfo(userId);
    if (accessInfos.length === 0) {
      return { hasPurchase: false, levels: [] };
    }

    const levels = accessInfos.map((info) => ({
      levelName: info.levelName,
      purchaseDate: info.purchaseDate,
      expiresAt: info.expiresAt,
      daysLeft: info.daysLeft,
      isExpired: info.isExpired,
    }));

    return { hasPurchase: true, levels };
  }
}

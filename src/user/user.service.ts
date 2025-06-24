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
import { Admin } from 'src/admin/models/admin.schema';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserStatus } from '../common/shared';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderService: OrderService,
    private readonly certificateRepo: CertificateRepo,
    private readonly ipService: IpService,
  ) {}
  private logger = new Logger(UserService.name);

  async create(createUserDto: CreateUserDto, ipAddress?: string) {
    const user = await this.userRepo.findOne({ email: createUserDto.email });
    if (user) {
      return null;
    }

    // hash password -- 10 is a constant
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    createUserDto.password = hashedPassword;

    // Set country based on IP address during signup
    if (ipAddress) {
      const country = this.ipService.getCountryFromIp(ipAddress);
      createUserDto.country = country;
    }
    log('ipAddress', ipAddress);
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

    // check if the user truly finished the level
    // by checking if the user finished day 50 in this level

    const completedDays = await this.getCompletedDaysInLevel(
      userId.toString(),
      completeLevelDto.level_name,
    );

    if (completedDays < 50) {
      throw new BadRequestException(
        'You have to finish all the days in this level',
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
    return await this.userRepo.markDayAsCompleted(userId, levelName, dayNumber);
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
  async updateUserStatus(userId: string, updateStatusDto: UpdateUserStatusDto): Promise<User> {
    const user = await this.userRepo.findOne({ _id: userId });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      status: updateStatusDto.status,
    };


    // with defualt messages
     if (updateStatusDto.status === UserStatus.BLOCKED) {
      updateData.suspendedAt = new Date();
      updateData.suspensionReason = updateStatusDto.reason || 'Account blocked by admin';
    } else if (updateStatusDto.status === UserStatus.SUSPENDED) {
      updateData.suspendedAt = new Date();
      updateData.suspensionReason = updateStatusDto.reason || 'Account suspended by admin';
    } else if (updateStatusDto.status === UserStatus.ACTIVE) {
      updateData.suspendedAt = null;
      updateData.suspensionReason = null;
    }

    const updatedUser = await this.userRepo.findOneAndUpdate(
      { _id: userId },
      updateData
    );

    this.logger.log(`User ${user.email} status updated to ${updateStatusDto.status}`);
    
    return updatedUser;
  }

  /**
   * Suspend a user
   */
  async suspendUser(userId: string, reason?: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.SUSPENDED,
      reason: reason || 'Account suspended due to inactivity (65+ days)'
    });
  }

  /**
   * Activate a user
   */
  async activateUser(userId: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.ACTIVE
    });
  }

  /**
   * Block a user permanently
   */
  async blockUser(userId: string, reason?: string): Promise<User> {
    return this.updateUserStatus(userId, {
      status: UserStatus.BLOCKED,
      reason: reason || 'Account blocked by admin'
    });
  }

  /**
   * Get users by status with pagination - optimized
   */
  async getUsersByStatus(status: UserStatus, paginationDto: PaginationDto) {
    // Use the repository's efficient pagination method
    return await this.userRepo.findWithPagination({ status }, paginationDto.page, paginationDto.limit);
  }
}

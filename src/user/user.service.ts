import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderService: OrderService,
    private readonly certificateRepo: CertificateRepo,
  ) {}
  private logger = new Logger(UserService.name);

  async create(createUserDto: CreateUserDto) {
    const user = await this.userRepo.findOne({ email: createUserDto.email });
    if (user) {
      // user already found
      return null;
    }

    // hash password -- 10 is a constant
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    createUserDto.password = hashedPassword;

    return this.userRepo.create(createUserDto);
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

  async getUserCompletedOrders(userId: string) {
    const userLevels = await this.orderService.findUserCompletedOrders(userId);
    // i want the levelnames only
    const levelNames = userLevels.map((level) => level.levelName);
    return levelNames;
  }

  async getCompletedDaysInLevel(userId: string, levelName: Level_Name) {
    const userLevels = await this.getUserCompletedOrders(userId);
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
    const userLevels = await this.getUserCompletedOrders(userId);

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
    const userLevels = await this.getUserCompletedOrders(userId);
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
    const userLevels = await this.getUserCompletedOrders(userId);
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
    const userLevels = await this.getUserCompletedOrders(userId);
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
}

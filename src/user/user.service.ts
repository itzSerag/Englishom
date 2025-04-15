import { Injectable, Logger, NotFoundException, } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRepo } from './repo/repo.user';
import * as bcrypt from 'bcrypt';
import { OrderService } from '../common/shared/services/order.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Level_Name } from '../common/shared/enums';
import { log } from 'console';

@Injectable()
export class UserService {

  constructor(
    private readonly userRepo: UserRepo,
    private readonly orderService: OrderService
  ) { }
  private logger = new Logger(UserService.name)

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
    return await this.userRepo.findOneAndDelete({ _id })
  }

  async findOneAndUpdate(_id: string, updateUserDto: UpdateUserDto) {
    return await this.userRepo.findOneAndUpdate({ _id }, updateUserDto)
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

  async markDayAsCompleted(userId: string, levelName: Level_Name, dayNumber: number) {

    const userLevels = await this.getUserCompletedOrders(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }


    return await this.userRepo.markDayAsCompleted(userId, levelName, dayNumber);

  }

  async markTaskAsCompleted(userId: string, levelName: Level_Name, dayNumber: number, taskName: string) {

    const userLevels = await this.getUserCompletedOrders(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    return await this.userRepo.markTaskAsCompleted(userId, levelName, dayNumber, taskName);
  }

  async getCompletedTasksInDay(userId: string, levelName: Level_Name, dayNumber: number) {

    const userLevels = await this.getUserCompletedOrders(userId);
    if (!userLevels.includes(levelName)) {
      throw new NotFoundException('User does not have this level');
    }

    return await this.userRepo.getCompletedTasksInDay(userId, levelName, dayNumber);
  }

}
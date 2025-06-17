import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ConflictException,
  ValidationPipe,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from '../common/shared/dto/user-dto';
import { CurrentUser } from '../auth/decorator/get-curr-user.decorator';
import { User } from './models/user.schema';
import { GetCompletedDaysDto } from './dto/get-completed-days.dto';
import { GetCompletedTasksDto } from './dto/get-completed-tasks.dto';
import { UserFinishDayDto } from './dto/user-finish-day.dto';
import { UserTaskDto } from './dto/user-task.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { log } from 'console';
import { SkipVerifiedGuard } from '../auth/guards/skip-verified.guard';
import { CompleteLevelDto } from './dto/complete-level.dto';
import { CertificateDto } from './dto/certificate.dto';
import { GetCertificateDto } from './dto/get-certificate';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SkipVerifiedGuard()
  @Get('me')
  async getMe(@CurrentUser() user: User) {
    const userLevels = await this.userService.getUserCompletedOrders(
      user._id.toString(),
    );

    return {
      user: new UserDto(user),
      levels: userLevels,
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    if (!user) {
      throw new ConflictException('User already exists');
    }
    return new UserDto(user);
  }

  // HAVE TO DO SOME PAGINATION HERE
  @UseGuards(AdminGuard)
  @Get('all')
  async findAll() {
    const users = await this.userService.findAll();
    return users.map((user) => new UserDto(user));
  }

  @Get('levels')
  async getUserLevels(@CurrentUser() user: User) {
    log('user', user);
    return await this.userService.getUserCompletedOrders(user._id.toString());
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.findOneAndUpdate(id, updateUserDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    if (id === 'admin' && user._id.toString() === id) {
      throw new BadRequestException('Admin cannot be deleted');
    }

    return await this.userService.deleteUser(id);
  }

  @Get('certificate/:level_name')
  async getUserCertificate(
    @CurrentUser() user: User,
    @Param() certificateDto: GetCertificateDto,
  ) {
    const certificate = await this.userService.getUserCertificate(
      user._id.toString(),
      certificateDto,
    );
    if (!certificate) {
      throw new BadRequestException('Certificate not found');
    }
    return new CertificateDto(certificate);
  }

  @Get('completed-days')
  async getCompletedDaysInLevel(
    @Query(ValidationPipe) dto: GetCompletedDaysDto,
    @CurrentUser() user: User,
  ) {
    return await this.userService.getCompletedDaysInLevel(
      user._id.toString(),
      dto.levelName,
    );
  }

  @Get('completed-tasks')
  async getCompletedTasksInDay(
    @Query(ValidationPipe) dto: GetCompletedTasksDto,
    @CurrentUser('_id') userId: string,
  ) {
    return await this.userService.getCompletedTasksInDay(
      userId,
      dto.levelName,
      dto.day,
    );
  }

  @Post('complete-day')
  async markDayAsCompleted(
    @Body() finishDayDto: UserFinishDayDto,
    @CurrentUser() user: User,
  ) {
    return await this.userService.markDayAsCompleted(
      user._id.toString(),
      finishDayDto.levelName,
      finishDayDto.day,
    );
  }

  @Post('complete-task')
  async markTaskAsCompleted(
    @Body() taskDto: UserTaskDto,
    @CurrentUser() user: User,
  ) {
    return await this.userService.markTaskAsCompleted(
      user._id.toString(),
      taskDto.levelName,
      taskDto.day,
      taskDto.taskName,
    );
  }

  @Post('complete-level')
  async markLevelAsCompleted(
    @CurrentUser() user: User,
    @Body() completeLevelDto: CompleteLevelDto,
  ) {
    const certificate = await this.userService.markLevelAsCompleted(
      user._id.toString(),
      completeLevelDto,
    );
    if (!certificate) {
      throw new Error('Something went wrong');
    }

    return new CertificateDto(certificate);
  }

  /// MUST BE AT THE END AND ADMIN ONLY
  @UseGuards(AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}

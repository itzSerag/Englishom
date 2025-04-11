import { Controller, Get, Post, Body, Patch, Param, Delete, ConflictException, ValidationPipe, Query, BadRequestException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from 'src/common/shared/dto/user-dto';
import { CurrentUser } from 'src/auth/decorator/get-curr-user.decorator';
import { User } from './models/user.schema';
import { GetCompletedDaysDto } from './dto/get-completed-days.dto';
import { GetCompletedTasksDto } from './dto/get-completed-tasks.dto';
import { UserFinishDayDto } from './dto/user-finish-day.dto';
import { UserTaskDto } from './dto/user-task.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';


@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    if (!user) {
      throw new ConflictException('User already exists');
    }
    return new UserDto(user);
  }

  @UseGuards(AdminGuard)
  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.findOneAndUpdate(id, updateUserDto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.userService.deleteUser(id);
  }

  @Get('levels')
  async getUserLevels(@CurrentUser() user: User) {

    return await this.userService.getUserCompletedOrders(user._id.toString());
  }

  @Get('/completed-days')
  async getCompletedDaysInLevel(
    @Query(ValidationPipe) dto: GetCompletedDaysDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.userService.getCompletedDaysInLevel(userId, dto.levelName);
  }

  @Get('/completed-tasks')
  async getCompletedTasksInDay(
    @Query(ValidationPipe) dto: GetCompletedTasksDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.userService.getCompletedTasksInDay(
      userId,
      dto.levelName,
      dto.day,
    );
  }

  @Post('/complete-day')
  async markDayAsCompleted(
    @Body(ValidationPipe) finishDayDto: UserFinishDayDto,
    @CurrentUser('_id') userId: string,
  ) {
    try {
      return await this.userService.markDayAsCompleted(
        userId,
        finishDayDto.levelName,
        finishDayDto.day,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to mark day as completed');
    }
  }

  @Post('/complete-task')
  async markTaskAsCompleted(
    @Body(ValidationPipe) taskDto: UserTaskDto,
    @CurrentUser('_id') userId: string,
  ) {
    try {
      return await this.userService.markTaskAsCompleted(
        userId,
        taskDto.levelName,
        taskDto.day,
        taskDto.taskName,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to mark task as completed');
    }
  }

}

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
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../user-auth/decorator/get-curr-user.decorator';
import { User } from './models/user.schema';
import { GetCompletedDaysDto } from './dto/get-completed-days.dto';
import { GetCompletedTasksDto } from './dto/get-completed-tasks.dto';
import { UserFinishDayDto } from './dto/user-finish-day.dto';
import { UserTaskDto } from './dto/user-task.dto';
import { SkipVerifiedGuard } from '../user-auth/guards/skip-verified.guard';
import { CompleteLevelDto } from './dto/complete-level.dto';
import { GetCertificateDto } from './dto/get-certificate';
import { Admin } from '../admin/models/admin.schema';
import { AdminRole } from 'src/common/shared';
import { UserJwtGuard } from '../user-auth/guards/user-jwt.guard';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminRoles } from '../admin-auth/decorators';
import { PaginationDto } from './dto/pagination.dto';
import { IpService } from '../common/services/ip.service';
import { Request } from 'express';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { cleanResponse } from '../common/utils/response.utils';

@UseGuards(UserJwtGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly ipService: IpService,
  ) {}

  @SkipVerifiedGuard()
  @Get('me')
  async getMe(@CurrentUser() user: User | Admin) {
    // Check if user is an admin
    if (user instanceof Admin || (user as any).adminRole) {
      // For admins, return just the admin data without user-specific details
      return {
        user: cleanResponse(user),
        levelsDetails: [], // Admins don't have level progress
      };
    }

    // For regular users, get their details including level progress
    return await this.userService.getUserDetails(user._id.toString());
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    this.ipService.getRealIp(req);
    const user = await this.userService.create(createUserDto);
    if (!user) {
      throw new ConflictException('User already exists');
    }
    return cleanResponse(user);
  }

  // Admin endpoint with pagination support
  @UseGuards(AdminJwtGuard)
  @Get('all')
  async findAll(@Query() paginationDto: PaginationDto) {
    const result = await this.userService.findAllWithPagination(paginationDto);

    return {
      ...result,
      data: result.data.map((user) => cleanResponse(user)),
    };
  }

  @Get('levels')
  async getUserLevels(@CurrentUser() user: User) {
    return await this.userService.getUserCompletedLevelNames(
      user._id.toString(),
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.findOneAndUpdate(id, updateUserDto);
  }

  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
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
    return cleanResponse(certificate);
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

    return cleanResponse(certificate);
  }

  @Post('reset-password')
  async resetPassword(
    @CurrentUser() user: User | Admin,
    resetPasswordDto: ResetPasswordDto,
  ) {
    await this.userService.resetPassword(user, resetPasswordDto);

    return {
      message: 'Password reset successful',
    };
  }

  /// MUST BE AT THE END AND ADMIN ONLY
  @UseGuards(AdminJwtGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}

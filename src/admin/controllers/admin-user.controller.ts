import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole, UserStatus } from '../../common/shared';
import { IsAdminGuard } from '../guards/is-admin.guard';
import { AdminRoleGuard } from '../guards/admin-roles.guard';
import { UserService } from '../../user/user.service';
import { UpdateUserStatusDto } from '../../user/dto/update-user-status.dto';
import { PaginationDto } from '../../user/dto/pagination.dto';
import { cleanSensitiveFields } from '../../common/utils/response.utils';

@UseGuards(IsAdminGuard, AdminRoleGuard)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get all users with pagination (MANAGER+ access)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get()
  async getAllUsers(@Query() paginationDto: PaginationDto) {
    const result = await this.userService.findAllWithPagination(paginationDto);
    return {
      ...result,
      data: result.data.map((user) => cleanSensitiveFields(user)),
    };
  }

  /**
   * Get users by status (MANAGER+ access)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('status/:status')
  async getUsersByStatus(
    @Param('status') status: UserStatus,
    @Query() paginationDto: PaginationDto,
  ) {
    const result = await this.userService.getUsersByStatus(status, paginationDto);
    return {
      ...result,
      data: result.data.map((user) => cleanSensitiveFields(user)),
    };
  }

  /**
   * Get a specific user by ID (MANAGER+ access)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    return cleanSensitiveFields(user);
  }

  /**
   * Update user status - suspend, activate, or block (SUPER and MANAGER only)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ) {
    const user = await this.userService.updateUserStatus(id, updateStatusDto);
    return {
      message: `User status updated to ${updateStatusDto.status}`,
      user: cleanSensitiveFields(user),
    };
  }

  /**
   * Quick suspend user (SUPER and MANAGER only)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const user = await this.userService.suspendUser(id, reason);
    return {
      message: 'User has been suspended',
      user: cleanSensitiveFields(user),
    };
  }

  /**
   * Quick activate user (SUPER and MANAGER only)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activateUser(@Param('id') id: string) {
    const user = await this.userService.activateUser(id);
    return {
      message: 'User has been activated',
      user: cleanSensitiveFields(user),
    };
  }

  /**
   * Block user permanently (SUPER only)
   */
  @AdminRoles(AdminRole.SUPER)
  @Patch(':id/block')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const user = await this.userService.blockUser(id, reason);
    return {
      message: 'User has been blocked',
      user: cleanSensitiveFields(user),
    };
  }
}

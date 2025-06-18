import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { UpdateUserDto } from '../../user/dto/update-user.dto';
import { AdminRoleGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { Admin } from '../models/admin.schema';
import { AdminRole } from '../../common/shared';

@Controller('admin/users')
@UseGuards(AdminRoleGuard)
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  // Get all users - MANAGER and above can view
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get()
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @CurrentAdmin() admin: Admin,
  ) {
    return await this.userService.findAll();
  }

  // Get user by ID - MANAGER and above can view
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get(':id')
  async getUserById(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return await this.userService.findById(id);
  }

  // Update user - MANAGER and above can update
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentAdmin() admin: Admin,
  ) {
    return this.userService.findOneAndUpdate(id, updateUserDto);
  }

  // Delete user - Only SUPER admin can delete users
  @AdminRoles(AdminRole.SUPER)
  @Delete(':id')
  async deleteUser(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return this.userService.deleteUser(id);
  }

  // Get user progress - MANAGER and above can view
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get(':id/progress')
  async getUserProgress(@Param('id') id: string, @CurrentAdmin() admin: Admin) {
    return this.userService.getUserCompletedOrders(id);
  }
}

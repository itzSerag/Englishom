import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  CreateAdminDto,
  UpdateAdminDto,
  AdminSearchDto,
  GetAdminDto,
} from './dto';
import { Admin } from './models/admin.schema';
import { CurrentAdmin } from '../admin-auth/decorators/current-admin.decorator';
import { AdminRoles } from '../admin-auth/decorators/admin-roles.decorator';
import { AdminJwtGuard, AdminRoleGuard } from '../admin-auth/guards';
import { AdminRole, UserStatus } from '../common/shared';
import { IpService } from 'src/common/services/ip.service';
import {
  cleanResponse,
  cleanResponseArray,
} from '../common/utils/response.utils';
import { UserService } from '../user/user.service';
import { UpdateUserStatusDto } from '../user/dto/update-user-status.dto';
import { PaginationDto } from '../user/dto/pagination.dto';

@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ipService: IpService,
    private readonly userService: UserService,
  ) {}

  @Get('me')
  async getCurrentAdmin(@CurrentAdmin() currentAdmin: Admin) {
    return cleanResponse(currentAdmin);
  }

  
  @AdminRoles(AdminRole.SUPER)
  @Post('create-admin')
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
    @Req() req: Request,
  ) {
    const ip = this.ipService.getRealIp(req);
    const admin = await this.adminService.createAdmin(
      createAdminDto,
      currentAdmin,
      ip,
    );
    return cleanResponse(admin);
  }

  // Search/filter admins with pagination - SUPER and MANAGER can view admins
  @Get('search')
  async searchAdmins(@Query() searchDto: AdminSearchDto) {
    return await this.adminService.searchAdmins(searchDto);
  }

  // Get all admins - SUPER and MANAGER can view all admins
  @Get('all')
  async getAllAdmins() {
    const admins = await this.adminService.getAllAdmins();
    return cleanResponseArray(admins);
  }

  
  @AdminRoles(AdminRole.SUPER)
  @Patch(':id')
  async updateAdmin(
    @Param() mongoID: GetAdminDto,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.updateAdmin(
      mongoID.id,
      updateAdminDto,
      currentAdmin,
    );
    return cleanResponse(admin);
  }

  // Delete admin - Only SUPER admin
  @AdminRoles(AdminRole.SUPER)
  @Delete(':id')
  async deleteAdmin(
    @Param() mongoID: GetAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    return await this.adminService.deleteAdmin(mongoID.id, currentAdmin);
  }

  @AdminRoles(AdminRole.SUPER)
  @Post('deactivate-admin/:id')
  async deactivateAdmin(@Param('id') id: string) {
    const admin = await this.adminService.deactivateAdmin(id);
    return cleanResponse(admin);
  }

  // ===== USER MANAGEMENT ENDPOINTS =====

  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('users')
  async getAllUsers(@Query() paginationDto: PaginationDto) {
    const result = await this.userService.findAllWithPagination(paginationDto);
    return {
      ...result,
      data: result.data.map((user) => cleanResponse(user)),
    };
  }

  // Get users by status - SUPER and MANAGER can view users by status
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('users/status/:status')
  async getUsersByStatus(
    @Param('status') status: UserStatus,
    @Query() paginationDto: PaginationDto,
  ) {
    const result = await this.userService.findByStatus(status, paginationDto);
    return {
      ...result,
      data: result.data.map((user) => cleanResponse(user)),
    };
  }

  // Get specific user by ID - SUPER and MANAGER can view user details
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('users/:id')
  async getUserById(@Param('id') userId: string) {
    const user = await this.userService.findById(userId);
    return cleanResponse(user);
  }

  // Update user status - SUPER and MANAGER can suspend/activate, only SUPER can block
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch('users/status/:id')
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    // Only SUPER admin can block users
    if (
      updateStatusDto.status === UserStatus.BLOCKED &&
      currentAdmin.adminRole !== AdminRole.SUPER
    ) {
      throw new ConflictException('Only SUPER admin can block users');
    }

    const user = await this.userService.updateUserStatus(
      userId,
      updateStatusDto,
    );
    return cleanResponse(user);
  }

  // Delete user - SUPER and MANAGER can delete users
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Delete('users/:id')
  async deleteUser(@Param('id') userId: string) {
    if (userId === 'admin') {
      throw new BadRequestException('Admin cannot be deleted');
    }
    const deletedUser = await this.userService.deleteUser(userId);
    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deleted successfully', user: cleanResponse(deletedUser) };
  }

  // Get admin by ID - SUPER and MANAGER can view admin details
  @Get(':id')
  async getAdminById(@Param() mongoID: GetAdminDto) {
    const admin = await this.adminService.getAdminById(mongoID.id);
    return cleanResponse(admin);
  }
}

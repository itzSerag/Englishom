import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto, UpdateAdminDto, AdminLoginDto } from './dto';
import { Admin } from './models/admin.schema';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { IsAdminGuard, AdminRoleGuard } from './guards';
import { AdminRole } from '../common/shared';
import { cleanSensitiveFields, cleanSensitiveFieldsArray } from '../common/utils/response.utils';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Create new admin - Only SUPER admin
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER)
  @Post('create-admin')
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.createAdmin(createAdminDto, currentAdmin);
    return cleanSensitiveFields(admin);
  }

  // Get all admins - SUPER and MANAGER
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('all')
  async getAllAdmins(@CurrentAdmin() currentAdmin: Admin) {
    const admins = await this.adminService.getAllAdmins(currentAdmin);
    return cleanSensitiveFieldsArray(admins);
  }

  // Get admin profile
  @UseGuards(IsAdminGuard)
  @Get('profile')
  async getProfile(@CurrentAdmin() admin: Admin) {
    const profile = await this.adminService.getProfile(admin);
    return cleanSensitiveFields(profile);
  }

  // Get admin by ID - SUPER and MANAGER
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get(':id')
  async getAdminById(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.getAdminById(id, currentAdmin);
    return cleanSensitiveFields(admin);
  }

  // Update admin
  @UseGuards(IsAdminGuard)
  @Patch(':id')
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.updateAdmin(id, updateAdminDto, currentAdmin);
    return cleanSensitiveFields(admin);
  }

  // Delete admin - Only SUPER admin
  @UseGuards(AdminRoleGuard)
  @AdminRoles(AdminRole.SUPER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    return await this.adminService.deleteAdmin(id, currentAdmin);
  }
}

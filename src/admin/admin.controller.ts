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
import { CreateAdminDto, UpdateAdminDto } from './dto';
import { Admin } from './models/admin.schema';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { IsAdminGuard, AdminRoleGuard } from './guards';
import { AdminRole } from '../common/shared';
import { cleanSensitiveFields, cleanSensitiveFieldsArray } from '../common/utils/response.utils';

@UseGuards(IsAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Create new admin - Only SUPER admin
  @AdminRoles(AdminRole.SUPER)
  @Post('create-admin')
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.createAdmin(createAdminDto, currentAdmin);
    return cleanSensitiveFields(admin);
  }

  @Get('all-active')
  async getAllActiveAdmins() {
    const admins = await this.adminService.getAllActiveAdmins();
    return cleanSensitiveFieldsArray(admins);
  }

  @Get('all')
  async getAllAdmins() {
    const admins = await this.adminService.getAllAdmins();
    return cleanSensitiveFieldsArray(admins);
  }

  // Get admin by ID - SUPER and MANAGER
  @Get(':id')
  async getAdminById(
    @Param('id') id: string,
  ) {
    const admin = await this.adminService.getAdminById(id);
    return cleanSensitiveFields(admin);
  }


  // Update admin
  @AdminRoles(AdminRole.SUPER)
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
  @AdminRoles(AdminRole.SUPER)
  @Delete(':id')
  async deleteAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    return await this.adminService.deleteAdmin(id, currentAdmin);
  }
}

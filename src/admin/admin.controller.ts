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
import { SuperAdminGuard, AdminRolesGuard } from './guards';
import { AdminRole } from '../common/shared';
import { Public } from '../auth/decorator/public.decorator';
import { cleanSensitiveFields, cleanSensitiveFieldsArray } from '../common/utils/response.utils';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

//   // Admin login - Public endpoint
//   @Public()
//   @Post('login')
//   @HttpCode(HttpStatus.OK)
//   async login(@Body() adminLoginDto: AdminLoginDto) {
//     const result = await this.adminService.login(adminLoginDto);
//     return {
//       access_token: result.access_token,
//       admin: cleanSensitiveFields(result.admin),
//     };
//   }

  // Create new admin - Only SUPER admin
  @UseGuards(SuperAdminGuard)
  @Post('create')
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.createAdmin(createAdminDto, currentAdmin);
    return cleanSensitiveFields(admin);
  }

  // Get all admins - SUPER and MANAGER
  @UseGuards(AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('all')
  async getAllAdmins(@CurrentAdmin() currentAdmin: Admin) {
    const admins = await this.adminService.getAllAdmins(currentAdmin);
    return cleanSensitiveFieldsArray(admins);
  }

  // Get admin profile
  @UseGuards(AdminRolesGuard)
  @Get('profile')
  async getProfile(@CurrentAdmin() admin: Admin) {
    const profile = await this.adminService.getProfile(admin);
    return cleanSensitiveFields(profile);
  }

  // Get admin by ID - SUPER and MANAGER
  @UseGuards(AdminRolesGuard)
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
  @UseGuards(AdminRolesGuard)
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
  @UseGuards(SuperAdminGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdmin(
    @Param('id') id: string,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    return await this.adminService.deleteAdmin(id, currentAdmin);
  }
}

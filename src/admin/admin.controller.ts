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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto, UpdateAdminDto, AdminSearchDto } from './dto';
import { Admin } from './models/admin.schema';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminRoles } from './decorators/admin-roles.decorator';
import { IsAdminGuard, AdminRoleGuard } from './guards';
import { AdminRole } from '../common/shared';
import { IpService } from 'src/common/services/ip.service';
import { SkipVerifiedGuard } from '../auth/guards/skip-verified.guard';
import {
  cleanResponse,
  cleanResponseArray,
} from '../common/utils/response.utils';

@UseGuards(IsAdminGuard)
@SkipVerifiedGuard()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ipService: IpService,
  ) {}

  // Create new admin - Only SUPER admin
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

  // Get admin by ID - SUPER and MANAGER can view admin details
  @Get(':id')
  async getAdminById(@Param('id') id: string) {
    const admin = await this.adminService.getAdminById(id);
    return cleanResponse(admin);
  }

  // Update admin
  @AdminRoles(AdminRole.SUPER)
  @Patch(':id')
  async updateAdmin(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: Admin,
  ) {
    const admin = await this.adminService.updateAdmin(
      id,
      updateAdminDto,
      currentAdmin,
    );
    return cleanResponse(admin);
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

  @AdminRoles(AdminRole.SUPER)
  @Post('deactivate-admin/:id')
  async deactivateAdmin(@Param('id') id: string) {
    const admin = await this.adminService.deactivateAdmin(id);
    return cleanResponse(admin);
  }

  @Get('me')
  async getCurrentAdmin(@CurrentAdmin() currentAdmin: Admin) {
    return cleanResponse(currentAdmin);
  }
}

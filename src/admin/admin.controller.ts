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
import { CreateAdminDto, UpdateAdminDto, AdminSearchDto, GetAdminDto } from './dto';
import { Admin } from './models/admin.schema';
import { CurrentAdmin } from '../admin-auth/decorators/current-admin.decorator';
import { AdminRoles } from '../admin-auth/decorators/admin-roles.decorator';
import { AdminJwtGuard, AdminRoleGuard } from '../admin-auth/guards';
import { AdminRole } from '../common/shared';
import { IpService } from 'src/common/services/ip.service';
import {
  cleanResponse,
  cleanResponseArray,
} from '../common/utils/response.utils';
import { log } from 'console';

@UseGuards(AdminJwtGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ipService: IpService,
  ) {}
  


  @Get('me')
  async getCurrentAdmin(@CurrentAdmin() currentAdmin: Admin) {
    log(currentAdmin)
    return cleanResponse(currentAdmin);
  }


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

  
  // Update admin
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
  
  // Get admin by ID - SUPER and MANAGER can view admin details
  @Get(':id')
  async getAdminById(@Param() mongoID: GetAdminDto) {
    const admin = await this.adminService.getAdminById(mongoID.id);
    return cleanResponse(admin);
  }
}

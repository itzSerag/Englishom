import { Controller, Post, Get, Delete, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '../../admin-auth/guards/is-admin.guard';
import { AdminRoleGuard } from '../../admin-auth/guards/admin-roles.guard';
import { AdminRoles } from '../../admin-auth/decorators/admin-roles.decorator';
import { AdminRole } from '../shared';
import { SeederService } from './seeder.service';

@UseGuards(IsAdminGuard, AdminRoleGuard)
@Controller('dev/seeder')
export class SeederController {
  constructor(private readonly seederService: SeederService) {}

  @AdminRoles(AdminRole.SUPER)
  @Post('seed-all')
  async seedAll() {
    await this.seederService.seedTestData();
    return {
      message: '🌱 All development data seeded successfully!',
      timestamp: new Date().toISOString(),
    };
  }

  @AdminRoles(AdminRole.SUPER)
  @Post('seed-admins')
  async seedAdmins() {
    await this.seederService['seedAdmins']();
    return {
      message: '👑 Admin data seeded successfully!',
      timestamp: new Date().toISOString(),
    };
  }

  @AdminRoles(AdminRole.SUPER)
  @Post('seed-users')
  async seedUsers() {
    await this.seederService['seedUsers']();
    return {
      message: '👥 User data seeded successfully!',
      timestamp: new Date().toISOString(),
    };
  }

  @AdminRoles(AdminRole.SUPER)
  @Post('seed-courses')
  async seedCourses() {
    await this.seederService['seedCourses']();
    return {
      message: '📚 Course data seeded successfully!',
      timestamp: new Date().toISOString(),
    };
  }

  @AdminRoles(AdminRole.SUPER)
  @Post('seed-orders')
  async seedOrders() {
    await this.seederService['seedOrders']();
    return {
      message: '💳 Order data seeded successfully!',
      timestamp: new Date().toISOString(),
    };
  }

  @AdminRoles(AdminRole.SUPER)
  @Delete('clear-all')
  async clearAll() {
    await this.seederService.clearAllData();
    return {
      message: '🗑️ All seeded data cleared!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('status')
  async getStatus() {
    return {
      message: '🌱 Seeder service is ready',
      environment: process.env.NODE_ENV,
      isDevelopment: process.env.NODE_ENV !== 'production',
      timestamp: new Date().toISOString(),
    };
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminRepo } from '../repo/admin.repo';
import { AdminRole } from '../../common/shared';

@Injectable()
export class AdminSeederService implements OnModuleInit {
  private readonly logger = new Logger(AdminSeederService.name);

  constructor(private readonly adminRepo: AdminRepo) {}

  async onModuleInit() {
    await this.createInitialSuperAdmin();
  }

  private async createInitialSuperAdmin() {
    try {
      // Check if any super admin exists
      const existingSuperAdmin = await this.adminRepo.findOne({
        adminRole: AdminRole.SUPER,
        isActive: true,
      });

      if (existingSuperAdmin) {
        this.logger.log('Super Admin already exists');
        return;
      }

      // Create initial super admin
      const defaultPassword = 'SuperAdmin123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const superAdmin = await this.adminRepo.create({
        email: 'superadmin@englishom.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: hashedPassword,
        adminRole: AdminRole.SUPER,
        isActive: true,
      });

      this.logger.log('Initial Super Admin created successfully');
      this.logger.warn(
        `Default Super Admin credentials:
         Email: superadmin@englishom.com
         Password: ${defaultPassword}
         ⚠️  PLEASE CHANGE THE PASSWORD IMMEDIATELY!`,
      );
    } catch (error) {
      this.logger.error('Failed to create initial Super Admin:', error);
    }
  }
}

import { Controller, Post, UseGuards } from '@nestjs/common';
import { InactiveUserCronService } from './inactive-user-cron.service';
import { AdminRoleGuard } from '../admin-auth/guards';
import { AdminRoles } from '../admin-auth/decorators/admin-roles.decorator';
import { AdminRole } from '../common/shared';

@UseGuards(AdminRoleGuard)
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: InactiveUserCronService) {}

  // Only super admin can trigger manually
  @AdminRoles(AdminRole.SUPER)
  @Post('trigger-inactive-users')
  async triggerInactiveUsersEmail() {
    await this.cronService.triggerManually();
    return {
      message: 'Inactive user management job triggered manually',
      timestamp: new Date().toISOString(),
    };
  }
}

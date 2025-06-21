import { Controller, Post, UseGuards } from '@nestjs/common';
import { InactiveUserCronService } from './inactive-user-cron.service';
import { IsAdminGuard } from '../admin/guards/is-admin.guard';
import { AdminRoles } from '../admin/decorators/admin-roles.decorator';
import { AdminRole } from '../common/shared';

@UseGuards(IsAdminGuard)
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: InactiveUserCronService) {}

  // Only super admin can trigger manually
  @AdminRoles(AdminRole.SUPER)
  @Post('trigger-inactive-users')
  async triggerInactiveUsersEmail() {
    await this.cronService.triggerManually();
    return {
      message: 'Inactive user email job triggered manually',
      timestamp: new Date().toISOString(),
    };
  }
}

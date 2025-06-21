import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InactiveUserCronService } from './inactive-user-cron.service';
import { CronController } from './cron.controller';
import { UserModule } from '../user/user.module';
import { MailModule } from '../common/mail/mail.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [ScheduleModule.forRoot(), UserModule, MailModule, AdminModule],
  controllers: [CronController],
  providers: [InactiveUserCronService],
  exports: [InactiveUserCronService],
})
export class CronModule {}

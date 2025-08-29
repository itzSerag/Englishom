import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ConfigModule } from '../common/config/config.module';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { CourseModule } from '../course/course.module';
import { PaymentModule } from '../payment/paymob.module';
import { DatabaseModule } from '../common/database/database.module';
import { MailModule } from '../common/mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule, // Add DatabaseModule to get TransactionService
    UserModule,
    AdminModule,
    CourseModule,
    PaymentModule,
    MailModule,
    // Assuming CourseModule is defined elsewhere
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

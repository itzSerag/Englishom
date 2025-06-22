import { Module, forwardRef } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ConfigModule } from '../common/config/config.module';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/paymob.module';

@Module({
  imports: [
    ConfigModule, 
    forwardRef(() => UserModule), 
    forwardRef(() => AdminModule),
    forwardRef(() => AuthModule),
    forwardRef(() => PaymentModule),
     // Assuming CourseModule is defined elsewhere
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

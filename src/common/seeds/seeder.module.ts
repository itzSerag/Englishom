import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeederController } from './seeder.controller';

// Import all required modules
import { AdminModule } from '../../admin/admin.module';
import { UserModule } from '../../user/user.module';
import { AuthModule } from '../../auth/auth.module';
import { PaymentModule } from '../../payment/paymob.module';
import { SeederService } from './seeder.service';

@Module({
  imports: [ConfigModule, AdminModule, UserModule, AuthModule, PaymentModule],
  controllers: [SeederController],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}

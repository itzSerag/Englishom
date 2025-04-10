import { Module } from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { PaymobController } from './paymob.controller';

@Module({
  providers: [PaymobService],
  controllers: [PaymobController],
  imports: [UsersModule, AuthModule],
})
export class PaymentModule {}

// filepath: /mnt/DATA/Englishom/src/payment/paymob.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../common/database/database.module';
import { OrderRepo } from './repo/order.repo';
import { Order, OrderSchema } from './models/order.schema';
import { UserModule } from '../user/user.module';
import { OrderService } from '../common/shared/services/order.service';
import { PaymobController } from './paymob.controller';
import { MailModule } from '../common/mail/mail.module';

// filepath: /mnt/DATA/Englishom/src/payment/paymob.module.ts
@Module({
  providers: [
    PaymobService,
    OrderRepo,
    {
      provide: OrderService,
      useExisting: OrderRepo,
    },
  ],
  controllers: [PaymobController],
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
    DatabaseModule,
    DatabaseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MailModule,
  ],
  exports: [PaymobService, OrderRepo, OrderService],
})
export class PaymentModule {}

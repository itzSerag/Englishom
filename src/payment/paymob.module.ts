// filepath: /mnt/DATA/Englishom/src/payment/paymob.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { AuthModule } from 'src/auth/auth.module';
import { PaymobController } from './paymob.controller';
import { DatabaseModule } from 'src/common/database/database.module';
import { OrderRepo } from './repo/order.repo';
import { Order, OrderSchema } from './models/order.schema';
import { UserModule } from 'src/user/user.module';
import { OrderService } from 'src/common/shared/services/order.service';

// filepath: /mnt/DATA/Englishom/src/payment/paymob.module.ts
@Module({
  providers: [
    PaymobService, 
    OrderRepo,
    {
      provide: OrderService,
      useExisting: OrderRepo
    }
  ],
  controllers: [PaymobController],
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
    DatabaseModule,
    DatabaseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  exports: [PaymobService, OrderRepo, OrderService],
})
export class PaymentModule { }
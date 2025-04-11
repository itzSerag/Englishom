import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymentRequestDTO } from './dto/orderData';
import { Level_Name } from '../common/shared/enums';
import { UserService } from 'src/user/user.service';

@Controller('payment')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private paymobService: PaymobService,
    private userService: UserService,
  ) { }

  @Post('/callback')
  async callbackPost(@Body() data: any, @Query() dataQuery: any) {
    const success = data.obj?.success;
    const orderId = data.obj?.id;
    const userEmail = data.obj?.order?.shipping_data.email;


    this.logger.log(`dataBody ${JSON.stringify(data)}`);
    this.logger.log(`dataQuery ${JSON.stringify(dataQuery)}`);
    try {
      const userData = await this.paymobService.handlePaymobCallback(
        orderId,
        success,
        data.obj.amount_cents,
        userEmail,
        data
      );

      return { userData };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to handle callback : ${err.message}`,
      );
    }
  }

  @Post('/process-payment')
  async processPayment(
    @Body() paymentIntention: PaymentRequestDTO,
    @Req() req: any,
  ) {
    const user = req.user;
    const integration_id = parseInt(process.env.PAYMOB_INTEGRATION_ID, 10);

    if (isNaN(integration_id)) {
      throw new BadRequestException('Invalid integration ID');
    }

    try {
      // Read the JSON object and pass it to the service method
      // const levelsData = __readCoursesData();
      // For simplicity, we'll hard-code the level data
      const levelsData = {
        Levels: [
          {
            name: 'BEGINNER',
            price: 10000,
            description: 'Beginner level',
          },
          {
            name: 'INTERMEDIATE',
            price: 15000,
            description: 'Intermediate level',
          },
          {
            name: 'ADVANCED',
            price: 20000,
            description: 'Advanced level',
          }
        ]
      };

      // Find the level by its name
      const level = levelsData.Levels.find(
        (lvl) => lvl.name === paymentIntention.level_name,
      );

      if (!level) {
        throw new BadRequestException('Invalid level name');
      }


      const data = {
        amount: level.price,
        currency: 'EGP',
        payment_methods: [integration_id],
        items: [
          {
            name: paymentIntention.level_name,
            amount: level.price,
            description: level.description,
            quantity: 1,
          },
        ],
        billing_data: {
          apartment: 'dummy',
          first_name: user.firstName,
          last_name: user.lastName,
          street: 'dummy',
          building: 'dummy',
          phone_number: paymentIntention.phone_number,
          city: paymentIntention.city,
          country: paymentIntention.country,
          email: user.email,
          floor: 'dummy',
          state: 'dummy',
        },
      };


      this.logger.log(`Processing payment for user ${user._id}, level: ${paymentIntention.level_name}`);

      // Process payment and pass userId to the service method
      const clientURL = await this.paymobService.processOrder(data, user._id.toString());

      return { clientURL };
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Payment processing failed: ${error.message}`,
      );
    }
  }

  @Post('/refund')
  async refundOrder(@Req() req: any, @Body('levelName') levelName: Level_Name) {
    try {
      const user = req.user;
      this.logger.log(`Refund requested for user ${user._id}, level: ${levelName}`);

      // Get all completed orders for this user
      const userOrders = await this.userService.getUserCompletedOrders(user._id.toString());

      // If the user doesn't have the item to refund
      if (
        userOrders.length === 0 ||
        !userOrders.some((order) => order.levelName === levelName)
      ) {
        throw new BadRequestException('No order found for this item');
      }

      // Find the specific order for this level
      const orderToRefund = userOrders.find(order => order.levelName === levelName);

      if (!orderToRefund?.paymentId) {
        throw new BadRequestException('Order has no payment ID');
      }

      const result = await this.paymobService.refundOrder(orderToRefund.paymentId);

      this.logger.log(`Refund successful for user ${user._id}, level: ${levelName}`);
      return result;
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Refund failed: ${error.message}`,
      );
    }
  }

  
  
}
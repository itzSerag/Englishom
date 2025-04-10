import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Query,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymentRequestDTO } from './dto/orderData';
import { UsersService } from 'src/users/users.service';
import { JwtAuthGuard } from 'src/auth/guard';
import { Level_Name } from '../common/enums';
import { __readCoursesData } from '../util/file-data-courses';
import { CurUser } from 'src/users/decorators/get-user.decorator';
import { User } from '@prisma/client';

@Controller('payment')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private paymobService: PaymobService,
    private userService: UsersService,
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
      );

      return { userData };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to handle callback : ${err.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/process-payment')
  async processPayment(
    @Body() paymentIntention: PaymentRequestDTO,
    @CurUser() user: User,
  ) {

    const integration_id = parseInt(process.env.PAYMOB_INTEGRATION_ID, 10);

    if (isNaN(integration_id)) {
      throw new BadRequestException('Invalid integration ID');
    }

    try {
      // Read the JSON object and pass it to the service method
      const levelsData = __readCoursesData();

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
          country: paymentIntention.country,  // Change country to Saudi Arabia
          email: user.email,
          floor: 'dummy',
          state: 'dummy',
        },
      };


      this.logger.log(`Processing payment for user ${user.id}, level: ${paymentIntention.level_name}`);

      // Process payment and pass userId to the service method
      const clientURL = await this.paymobService.processOrder(data, user.id);

      return { clientURL };
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Payment processing failed: ${error.message}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/refund')
  async refundOrder(@Req() req: any, @Body('levelName') levelName: Level_Name) {
    try {
      const userId = req.user.id;
      this.logger.log(`Refund requested for user ${userId}, level: ${levelName}`);

      // an array of type Order
      const userOrders = await this.userService.getUserCompletedOrders(userId);

      // if the user orders got this item that he want to refund or not
      if (
        userOrders.length === 0 ||
        !userOrders.some((order) => order.levelName === levelName)
      ) {
        throw new BadRequestException('No order found for this item');
      }

      const { success } = await this.paymobService.refundOrder(
        userOrders[0].paymentId,
      );

      if (!success) {
        throw new BadRequestException('Failed to refund the order');
      }

      this.logger.log(`Refund successful for user ${userId}, level: ${levelName}`);
      return { success };
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Refund failed: ${error.message}`,
      );
    }
  }
}
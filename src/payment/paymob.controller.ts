import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymentRequestDTO } from './dto/orderData';
import { Level_Name } from '../common/shared/enums';
import { UserService } from '../user/user.service';
import { CurrentUser } from '../auth/decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorator/public.decorator';
import { CourseService } from '../auth/services/course.service';

@Controller('payment')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private readonly configService: ConfigService,
    private paymobService: PaymobService,
    private userService: UserService,
    private courseService: CourseService,
  ) { }

  @Public()
  @Post('callback')
  async callbackPost(@Body() data: any) {
    const success = data.obj?.success;
    const orderId = data.obj?.id;
    const userEmail = data.obj?.order?.shipping_data.email;

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

  @Post('process-payment')
  async processPayment(
    @Body() paymentIntention: PaymentRequestDTO,
    @CurrentUser() user: User,
  ) {
    const integration_id = this.configService.get<number>(
      'PAYMOB_INTEGRATION_ID',
    );

    if (isNaN(integration_id)) {
      throw new BadRequestException('Invalid integration ID');
    }

    try {
      // Get course data from the database instead of hard-coded values
      let course;
      try {
        course = await this.courseService.findByLevelName(paymentIntention.level_name);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException('Invalid level name');
        }
        throw error;
      }

      const data = {
        amount: course.price * 100, // Convert to EGP piasters
        currency: 'EGP',
        payment_methods: [integration_id],
        items: [
          {
            name: paymentIntention.level_name,
            amount: course.price,
            description: course.description || `${course.title} course`,
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

      this.logger.log(
        `Processing payment for user ${user._id}, level: ${paymentIntention.level_name}`,
      );

      // Process payment and pass userId to the service method
      const clientURL = await this.paymobService.processOrder(
        data,
        user._id.toString(),
      );

      return { clientURL };
    } catch (error) {
      this.logger.error(
        `Payment processing failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Payment processing failed: ${error.message}`,
      );
    }
  }

  @Post('refund')
  async refundOrder(@Req() req: any, @Body('levelName') levelName: Level_Name) {
    try {
      const user = req.user;
      this.logger.log(
        `Refund requested for user ${user._id}, level: ${levelName}`,
      );

      // Get all completed orders for this user
      const userOrders = await this.userService.getUserCompletedOrders(
        user._id.toString(),
      );

      // If the user doesn't have the item to refund
      if (
        userOrders.length === 0 ||
        !userOrders.some((order) => order.levelName === levelName)
      ) {
        throw new BadRequestException('No order found for this item');
      }

      // Find the specific order for this level
      const orderToRefund = userOrders.find(
        (order) => order.levelName === levelName,
      );

      if (!orderToRefund?.paymentId) {
        throw new BadRequestException('Order has no payment ID');
      }

      const result = await this.paymobService.refundOrder(
        orderToRefund.paymentId,
      );

      this.logger.log(
        `Refund successful for user ${user._id}, level: ${levelName}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Refund failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }
} 
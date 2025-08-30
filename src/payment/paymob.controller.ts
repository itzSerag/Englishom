import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymentRequestDTO } from './dto/orderData';
import { Level_Name } from '../common/shared/enums';
import { UserService } from '../user/user.service';
import { CurrentUser } from '../user-auth/decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { ConfigService } from '@nestjs/config';
import { Public } from '../user-auth/decorator/public.decorator';
import { CourseService } from '../course/course.service';
import { Course } from '../course/models/course.schema';
import { PaymentStatus } from './types';
import { UserJwtGuard } from '../user-auth/guards/user-jwt.guard';

@Controller('payment')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymobService: PaymobService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
  ) {}

  // Web hook
  @Public()
  @Post('callback')
  async callbackPost(@Body() data: any) {
    this.logger.log('Paymob callback received:', JSON.stringify(data, null, 2));

    const success = data.obj?.success;
    const orderId = data.obj?.id;

    // Try multiple ways to extract email in case structure is different
    let userEmail = data.obj?.order?.shipping_data?.email;
    if (!userEmail) {
      userEmail = data.obj?.order?.billing_data?.email;
    }
    if (!userEmail) {
      userEmail = data.obj?.billing_data?.email;
    }
    if (!userEmail) {
      userEmail = data.obj?.shipping_data?.email;
    }

    const isPending = data.obj?.pending;
    const isCaptured = data.obj?.is_captured;
    const amountCents = data.obj?.amount_cents;

    this.logger.log(
      `Callback details: success=${success}, orderId=${orderId}, email=${userEmail}, pending=${isPending}, captured=${isCaptured}, amount=${amountCents}`,
    );

    if (!userEmail) {
      this.logger.error('Could not extract user email from callback data');
      this.logger.error(
        'Callback data structure:',
        JSON.stringify(data, null, 2),
      );
      throw new BadRequestException('User email not found in callback data');
    }

    try {
      const userData = await this.paymobService.handlePaymobCallbackWithRetry(
        orderId,
        success,
        data.obj.amount_cents,
        userEmail,
      );

      this.logger.log('Callback handled successfully', { userData });
      return { userData };
    } catch (err) {
      this.logger.error(`Failed to handle callback: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `Failed to handle callback : ${err.message}`,
      );
    }
  }

  @UseGuards(UserJwtGuard)
  @Post('process-payment')
  async processPayment(
    @Body() paymentIntention: PaymentRequestDTO,
    @CurrentUser() user: User,
  ) {
    // Debug log to check if user is properly passed
    this.logger.log(`Processing payment - User object:`, user);
    this.logger.log(`User role: ${user.role}, User ID: ${user._id}`);
    
    if (!user) {
      throw new BadRequestException('User authentication required');
    }

    // Check if the authenticated user is an admin
    if ('adminRole' in user ) {
      throw new BadRequestException('Admins cannot purchase courses. All courses are already available to admin accounts.');
    }

    if (!user.firstName || !user.lastName || !user.email) {
      throw new BadRequestException('User profile incomplete - missing required fields');
    }

    const integration_id = this.configService.get<number>(
      'PAYMOB_INTEGRATION_ID',
    );

    if (isNaN(integration_id)) {
      throw new BadRequestException('Invalid integration ID');
    }

    try {
      // Get course data from the database instead of hard-coded values
      let course: Course;
      try {
        course = await this.courseService.findByLevelName(
          paymentIntention.level_name,
        );
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException('Invalid level name');
        }
        throw error;
      }

      const data = {
        amount: course.price, // Use whole currency amount for our internal processing
        currency: 'EGP',
        payment_methods: [integration_id],
        items: [
          {
            name: paymentIntention.level_name,
            amount: course.price, // Use whole currency amount for our internal processing
            description: course.descriptionEn || `${course.titleEn} course`,
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

  @Get('debug/order/:userId')
  async debugUserOrders(
    @Param('userId') userId: string,
    @Query('levelName') levelName?: Level_Name,
  ) {
    try {
      const allOrders = await this.paymobService.orderRepo.find({
        userId: userId,
        ...(levelName && { levelName }),
      });

      const pendingOrders = await this.paymobService.orderRepo.find({
        userId: userId,
        paymentStatus: PaymentStatus.PENDING,
        ...(levelName && { levelName }),
      });

      const completedOrders = await this.paymobService.orderRepo.find({
        userId: userId,
        paymentStatus: PaymentStatus.COMPLETED,
        ...(levelName && { levelName }),
      });

      return {
        total: allOrders?.length || 0,
        pending: pendingOrders?.length || 0,
        completed: completedOrders?.length || 0,
        orders:
          allOrders?.map((order) => ({
            id: order._id,
            levelName: order.levelName,
            status: order.paymentStatus,
            amount: order.amount, // Now using whole currency amount
            paymentId: order.paymentId,
            createdAt: order.createdAt,
            paymentDate: order.paymentDate,
          })) || [],
      };
    } catch (error) {
      this.logger.error(`Debug orders failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Debug failed: ${error.message}`);
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

  @Post('verify/:paymentId')
  async verifyPayment(@Param('paymentId') paymentId: string) {
    try {
      const paymentData =
        await this.paymobService.verifyPaymentStatus(paymentId);

      // Find the order with this payment ID
      const order = await this.paymobService.orderRepo.findOne({
        paymentId: paymentId,
      });

      if (!order) {
        return {
          paymentData,
          orderFound: false,
          message: 'Payment verified but no matching order found',
        };
      }

      return {
        paymentData,
        orderFound: true,
        currentOrderStatus: order.paymentStatus,
        order: {
          id: order._id,
          levelName: order.levelName,
          amount: order.amount, // Now using whole currency amount
          status: order.paymentStatus,
          createdAt: order.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `Payment verification failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Verification failed: ${error.message}`);
    }
  }
}

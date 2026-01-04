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
  UnauthorizedException,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { PaymentRequestDto } from './dto/orderData';
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
import { PaymobCallbackData } from './types/callback';
import * as crypto from 'crypto';
import { AdminJwtGuard } from '../admin-auth/guards';
import { AuthMessages } from '../common/shared/const';
import { log } from 'console';
import { OrderSearchDto, OrderReportDto } from './dto/order-search.dto';

@Controller('payment')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymobService: PaymobService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
  ) {}

  private validateHMAC(
    data: PaymobCallbackData,
    providedHMAC: string,
  ): boolean {
    const hmacSecret = this.configService.get<string>('PAYMOB_HMAC_SECRET');

    try {
      // Extract the required fields for HMAC calculation
      const obj = data.obj;
      const order = obj.order;
      const sourceData = obj.source_data;

      // Concatenate the fields in the exact order specified by Paymob
      const concatenatedString = [
        obj.amount_cents,
        obj.created_at,
        obj.currency,
        obj.error_occured,
        obj.has_parent_transaction,
        obj.id,
        obj.integration_id,
        obj.is_3d_secure,
        obj.is_auth,
        obj.is_capture,
        obj.is_refunded,
        obj.is_standalone_payment,
        obj.is_voided,
        order.id,
        obj.owner,
        obj.pending,
        sourceData.pan,
        sourceData.sub_type,
        sourceData.type,
        obj.success,
      ].join('');

      // Generate HMAC using SHA-512
      const calculatedHMAC = crypto
        .createHmac('sha512', hmacSecret)
        .update(concatenatedString)
        .digest('hex');

      this.logger.log(`Calculated HMAC: ${calculatedHMAC}`);
      this.logger.log(`Provided HMAC: ${providedHMAC}`);

      // Compare the HMACs (case-insensitive)
      const isValid =
        calculatedHMAC.toLowerCase() === providedHMAC.toLowerCase();

      if (!isValid) {
        this.logger.error('HMAC validation failed - signatures do not match');
      } else {
        this.logger.log('HMAC validation successful');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`HMAC validation error: ${error.message}`);
      return false;
    }
  }

  // Web hook
  @Public()
  @Post('callback')
  async callbackPost(
    @Body() data: PaymobCallbackData,
    @Query('hmac') hmac: string,
  ) {
    this.logger.log('Received callback data:', JSON.stringify(data, null, 2));

    // Validate HMAC
    if (!this.validateHMAC(data, hmac)) {
      this.logger.error('HMAC validation failed');
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    const success = data.obj?.success;
    const orderId = data.obj?.id;

    // Try multiple ways to extract email in case structure is different
    let userEmail = data.obj?.order?.shipping_data?.email;
    if (!userEmail) {
      userEmail = data.obj?.payment_key_claims?.billing_data?.email;
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
    @Body() paymentIntentionDto: PaymentRequestDto,
    @CurrentUser() user: User,
  ) {
    if (!user) {
      throw new BadRequestException('User authentication required');
    }

    // Check if the authenticated user is an admin
    if ('adminRole' in user) {
      throw new BadRequestException(
        'Admins cannot purchase courses. All courses are already available to admin accounts.',
      );
    }

    if (!user.firstName || !user.lastName || !user.email) {
      throw new BadRequestException(
        'User profile incomplete - missing required fields',
      );
    }

    const integration_id = this.configService.get<number>(
      'PAYMOB_INTEGRATION_ID',
    );

    if (isNaN(integration_id)) {
      throw new BadRequestException('Invalid integration ID');
    }

    try {
      let course: Course;
      try {
        // Name of the course already uniquely identifies the course
        course = await this.courseService.findByLevelName(
          paymentIntentionDto.level_name,
        );
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException('Invalid level name');
        }
        throw error;
      }

      // SAUDI ARABIA

      const data = {
        amount: course.price, // Use whole currency amount for our internal processing
        currency: 'SAR', // <- Saudi Riyal
        payment_methods: [integration_id],
        items: [
          {
            name: paymentIntentionDto.level_name,
            amount: course.price,
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
          phone_number: '+966500000000', // <- KSA phone format
          city: 'dummy',
          country: 'SA', // <- Saudi Arabia
          email: user.email,
          floor: 'dummy',
          state: 'dummy',
        },
      };

      this.logger.log(
        `Processing payment for user ${user._id}, level: ${paymentIntentionDto.level_name}`,
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

  // ADMIN: get all orders for a specific user (no reports, just that user's history)
  @UseGuards(AdminJwtGuard)
  @Get('orders/user/:userId')
  async getUserOrdersDetails(@Param('userId') userId: string) {
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid userId format');
    }

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(AuthMessages.USER_NOT_FOUND_OR_INACTIVE);
    }

    try {
      const orders = await this.paymobService.orderRepo.find({
        userId: user._id,
      });

      return {
        total: orders?.length || 0,
        orders,
      };
    } catch (error) {
      throw new InternalServerErrorException(`failed: ${error.message}`);
    }
  }

  
  // Search orders with pagination / filters - ADMIN ONLY
  @UseGuards(AdminJwtGuard)
  @Get('orders/search-orders')
  async searchOrders(@Query() searchDto: OrderSearchDto) {
    const { userId } = searchDto;

    // If userId is provided, validate and ensure user exists
    if (userId) {
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new NotFoundException(AuthMessages.USER_NOT_FOUND_OR_INACTIVE);
      }
    }

    try {
      // Returns { data, total, page, limit, totalPages }
      return await this.paymobService.searchOrders(searchDto);
    } catch (error) {
      throw new InternalServerErrorException(`failed: ${error.message}`);
    }
  }

  // Reports endpoint: same filters (paymentId, userId, period, date) but returns all records
  @UseGuards(AdminJwtGuard)
  @Get('orders/reports')
  async getOrdersReport(@Query() reportDto: OrderReportDto) {
    try {
      // Returns a plain array of orders with embedded `user` object
      return await this.paymobService.getOrdersReport(reportDto);
    } catch (error) {
      throw new InternalServerErrorException(`failed: ${error.message}`);
    }
  }

  
  // search orders for a specific id payment - ADMIN ONLY
  @UseGuards(AdminJwtGuard)
  @Get('orders/:paymentId')
  async getOrdersByPaymentId(@Param('paymentId') paymentId: number )
  {
    // if there is no paymentId list all the orders with pagination
    if(!paymentId){
      throw new BadRequestException('paymentId query parameter is required');
    }
    const order = await this.paymobService.orderRepo.find({
      paymentId: paymentId,
    }); 
    return { order };
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

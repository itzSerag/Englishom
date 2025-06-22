import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentRequest, PaymentStatus } from './types';
import { Level_Name } from '../common/shared/enums';
import { OrderRepo } from './repo/order.repo';
import { TransactionService } from '../common/database/transaction.service';
import { UserRepo } from '../user/repo/user.repo';

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly PAYMOB_SECRET_KEY: string;
  private readonly integrationId: string;
  private readonly PAYMOB_PUBLIC_KEY: string;
  private readonly REQUEST_TIMEOUT = 10000; // Reduced to 10 seconds timeout

  constructor(
    private readonly configService: ConfigService,
    public readonly orderRepo: OrderRepo,
    private readonly transactionService: TransactionService,
    private readonly userRepo: UserRepo,
  ) {
    // Integration ID can be either string or number from config
    const integrationIdValue = this.configService.getOrThrow<string | number>(
      'PAYMOB_INTEGRATION_ID',
    );
    this.integrationId = integrationIdValue.toString();
    
    this.PAYMOB_PUBLIC_KEY =
      this.configService.getOrThrow<string>('PAYMOB_PUBLIC_KEY');
    this.PAYMOB_SECRET_KEY =
      this.configService.getOrThrow<string>('PAYMOB_SECRET_KEY');
  }

  /**
   * Create payment intention with Paymob
   */
  private async createIntention(paymentRequest: PaymentRequest): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT,
    );

    try {
      const res = await fetch('https://accept.paymob.com/v1/intention/', {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.PAYMOB_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const error = await res.text();
        throw new HttpException(
          `Failed to create payment intention: ${error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Payment gateway request timed out',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new HttpException(
        `Payment gateway error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Process a new order with transaction support
   */
  async processOrder(
    paymentRequest: PaymentRequest,
    userId: string,
  ): Promise<string> {
    return await this.transactionService.withTransaction(async (session) => {
      // Validate input
      if (!paymentRequest?.items?.length || !paymentRequest.items[0].name) {
        throw new BadRequestException(
          'Invalid payment request: missing items or item name',
        );
      }

      const levelName = paymentRequest.items[0].name as Level_Name;

      // Check for existing completed order using transaction session
      const existingCompletedOrder = await this.orderRepo.findCompletedOrder(
        userId,
        levelName,
        session,
      );

      if (existingCompletedOrder) {
        throw new BadRequestException('User already has this level');
      }

      // Create payment intention
      const dataUserPaymentIntention =
        await this.createIntention(paymentRequest);
      if (!dataUserPaymentIntention?.client_secret) {
        throw new InternalServerErrorException(
          'Failed to create payment intention',
        );
      }

      // Create or update order record with transaction session
      this.logger.log(`Creating/updating order for user ${userId}, level ${levelName}, amount ${paymentRequest.amount}`);
      
      try {
        const order = await this.orderRepo.upsertOrder(
          userId,
          levelName,
          paymentRequest.amount,
          session,
        );
        
        this.logger.log(`Order upserted successfully: ${order._id}`);
      } catch (err) {
        this.logger.error('Failed to upsert the order:', err);
        this.logger.error(`Details - userId: ${userId}, levelName: ${levelName}, amount: ${paymentRequest.amount}`);
        throw new InternalServerErrorException('Failed to upsert the order');
      }

      return `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.PAYMOB_PUBLIC_KEY}&clientSecret=${dataUserPaymentIntention.client_secret}`;
    });
  }

  /**
   * Handle Paymob callback with transaction support
   */
  async handlePaymobCallback(
    orderId: number,
    success: boolean,
    amount: number,
    userEmail: string,
  ): Promise<boolean> {
    this.logger.log(`Processing callback: orderId=${orderId}, success=${success}, amount=${amount}, email=${userEmail}`);
    
    return await this.transactionService.withTransaction(async (session) => {
      if (!userEmail) {
        this.logger.error('User email is missing from callback');
        throw new BadRequestException('User email is required');
      }

      // Get user by email - do this first to fail fast if user doesn't exist
      const user = await this.userRepo.findOne({ email: userEmail });
      if (!user) {
        this.logger.error(`User not found with email: ${userEmail}`);
        throw new NotFoundException('User not found');
      }

      this.logger.log(`Found user: ${user._id} for email: ${userEmail}`);

      if (!success) {
        this.logger.log('Payment failed, updating order status to FAILED');
        // For failed payments, find and update the order status to FAILED
        const pendingOrder = await this.orderRepo.findOne(
          {
            userId: user._id,
            paymentStatus: PaymentStatus.PENDING,
            amountCents: amount,
          },
          session,
        );

        if (pendingOrder) {
          this.logger.log(`Updating failed order ${pendingOrder._id} to FAILED status`);
          await this.orderRepo.updateOrderStatus(
            pendingOrder._id.toString(),
            PaymentStatus.FAILED,
            orderId.toString(),
            session,
          );
        }

        return false;
      }

      // Payment was successful
      this.logger.log('Payment successful, looking for pending order to complete');
      
      // Find the pending order for this user and amount
      const pendingOrder = await this.orderRepo.findOne(
        {
          userId: user._id,
          paymentStatus: PaymentStatus.PENDING,
          amountCents: amount,
        },
        session,
      );

      if (!pendingOrder) {
        this.logger.error(`No pending order found for user ${user._id} with amount ${amount}`);
        
        // Check if there's an order with same amount but different status
        const existingOrder = await this.orderRepo.findOne(
          {
            userId: user._id,
            amountCents: amount,
          },
          session,
        );

        if (existingOrder) {
          this.logger.error(`Order already exists with status: ${existingOrder.paymentStatus}`);
          throw new BadRequestException(
            `Order already exists with status: ${existingOrder.paymentStatus}`,
          );
        }

        throw new NotFoundException('No matching pending order found');
      }

      this.logger.log(`Found pending order ${pendingOrder._id}, updating to COMPLETED`);

      // Update order status to COMPLETED
      await this.orderRepo.updateOrderStatus(
        pendingOrder._id.toString(),
        PaymentStatus.COMPLETED,
        orderId.toString(),
        session,
      );

      // Verify the update was successful
      const updatedOrder = await this.orderRepo.findOne(
        { _id: pendingOrder._id },
        session,
      );

      if (updatedOrder?.paymentStatus !== PaymentStatus.COMPLETED) {
        this.logger.error(`Failed to update order status. Current status: ${updatedOrder?.paymentStatus}`);
        throw new InternalServerErrorException('Failed to update order status');
      }

      this.logger.log(`Successfully updated order ${pendingOrder._id} to COMPLETED status`);
      return true;
    });
  }

  /**
   * Handle Paymob callback with retry mechanism for potential race conditions
   */
  async handlePaymobCallbackWithRetry(
    orderId: number,
    success: boolean,
    amount: number,
    userEmail: string,
    retryCount: number = 0,
  ): Promise<boolean> {
    const maxRetries = 3;
    const retryDelayMs = 1000; // 1 second

    try {
      return await this.handlePaymobCallback(orderId, success, amount, userEmail);
    } catch (error) {
      if (retryCount < maxRetries && 
          (error.message.includes('No matching pending order found') || 
           error.message.includes('Failed to update order status'))) {
        
        this.logger.warn(`Callback failed, retrying in ${retryDelayMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        
        return await this.handlePaymobCallbackWithRetry(
          orderId, 
          success, 
          amount, 
          userEmail, 
          retryCount + 1
        );
      }
      
      throw error;
    }
  }

  /**
   * Refund an order with transaction support
   */
  async refundOrder(orderId: string): Promise<any> {
    return await this.transactionService.withTransaction(async (session) => {
      const order = await this.orderRepo.findOne(
        { paymentId: orderId },
        session,
      );
      if (!order) {
        throw new NotFoundException(
          `Order with payment ID ${orderId} not found`,
        );
      }

      // Update order status to REFUNDED with transaction session
      await this.orderRepo.updateOrderStatus(
        order._id.toString(),
        PaymentStatus.REFUNDED,
        undefined,
        session,
      );

      return { success: true };
    });
  }

  /**
   * Verify payment status directly with Paymob API
   */
  async verifyPaymentStatus(paymentId: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT,
    );

    try {
      const res = await fetch(`https://accept.paymob.com/api/acceptance/transactions/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Token ${this.PAYMOB_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const error = await res.text();
        throw new HttpException(
          `Failed to verify payment status: ${error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const paymentData = await res.json();
      this.logger.log(`Payment verification for ${paymentId}:`, paymentData);
      
      return paymentData;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Payment verification request timed out',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new HttpException(
        `Payment verification error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

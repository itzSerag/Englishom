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
    this.integrationId = this.configService.getOrThrow<string>(
      'PAYMOB_INTEGRATION_ID',
    );
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
      try {
        await this.orderRepo.upsertOrder(
          userId,
          levelName,
          paymentRequest.amount,
          session,
        );
      } catch (err) {
        this.logger.error('failed to upsert the order, ', err);
        throw new InternalServerErrorException('failed to upsert the order');
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
    return await this.transactionService.withTransaction(async (session) => {
      if (!userEmail) {
        throw new BadRequestException('User email is required');
      }

      // Get user by email - do this first to fail fast if user doesn't exist
      const user = await this.userRepo.findOne({ email: userEmail });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!success) {
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
          await this.orderRepo.updateOrderStatus(
            pendingOrder._id.toString(),
            PaymentStatus.FAILED,
            orderId.toString(),
            session,
          );
        }

        return false;
      }

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
        // Check if there's an order with same amount but different status
        const existingOrder = await this.orderRepo.findOne(
          {
            userId: user._id,
            amountCents: amount,
          },
          session,
        );

        if (existingOrder) {
          throw new BadRequestException(
            `Order already exists with status: ${existingOrder.paymentStatus}`,
          );
        }

        throw new NotFoundException('No matching pending order found');
      }

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
        throw new InternalServerErrorException('Failed to update order status');
      }

      return true;
    });
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
}

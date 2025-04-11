import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentRequest, PaymentStatus } from './types';
import { Level_Name } from '../common/shared/enums';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentPostBodyCallback } from './types/callback';
import { OrderRepo } from './repo/order.repo';
import { TransactionService } from 'src/common/database/transaction.service';

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly PAYMOB_SECRET_KEY: string;
  private readonly integrationId: string;
  private readonly hmacSecret: string;
  private readonly PAYMOB_PUBLIC_KEY: string;
  private readonly REQUEST_TIMEOUT = 20000; // 20 seconds timeout

  constructor(
    private readonly configService: ConfigService,
    public readonly orderRepo: OrderRepo,
    private readonly transactionService: TransactionService,
  ) {
    this.integrationId = this.configService.getOrThrow<string>('PAYMOB_INTEGRATION_ID');
    this.hmacSecret = this.configService.getOrThrow<string>('PAYMOB_HMAC_SECRET');
    this.PAYMOB_PUBLIC_KEY = this.configService.getOrThrow<string>('PAYMOB_PUBLIC_KEY');
    this.PAYMOB_SECRET_KEY = this.configService.getOrThrow<string>('PAYMOB_SECRET_KEY');
  }

  /**
   * Create payment intention with Paymob
   */
  private async createIntention(paymentRequest: PaymentRequest): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

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
        this.logger.error(`Paymob API error: ${error}`);
        throw new HttpException(
          `Failed to create payment intention: ${error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const data = await res.json();
      this.logger.debug('Payment intention created successfully', data);
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Payment gateway request timed out',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      this.logger.error(`Failed to create payment intention: ${error.message}`);
      throw new HttpException(
        `Payment gateway error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify HMAC signature from Paymob callback
   * @param callbackData The callback data object
   * @returns boolean indicating if HMAC is valid
   */
  verifyHmac(callbackData: PaymentPostBodyCallback): boolean {
    try {
      // Extract HMAC from the callback data if provided by Paymob
      const hmacHeader = callbackData.hmac;
      this.logger.log(hmacHeader);

      if (!hmacHeader) {
        this.logger.warn('Missing HMAC in callback data');
        return false;
      }

      // Create a string to hash according to Paymob's documentation
      // Note: The exact fields and format will depend on Paymob's specification
      // This is a sample implementation that should be adjusted based on Paymob's documentation
      const dataToHash = [
        callbackData.obj.id.toString(),
        callbackData.obj.amount_cents.toString(),
        callbackData.obj.created_at,
        callbackData.obj.currency,
        callbackData.obj.order.id.toString(),
        callbackData.obj.success.toString()
      ].join('');


      // Calculate HMAC using SHA256
      const calculatedHmac = crypto
        .createHmac('sha256', this.hmacSecret)
        .update(dataToHash)
        .digest('hex');

      // Compare HMAC values
      const isValid = calculatedHmac === hmacHeader;

      if (!isValid) {
        this.logger.warn('Invalid HMAC signature in callback request');
        this.logger.debug(`Calculated: ${calculatedHmac}, Received: ${hmacHeader}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying HMAC: ${error.message}`);
      return false;
    }
  }

  /**
   * Process a new order with transaction support
   */
  async processOrder(paymentRequest: PaymentRequest, userId: string): Promise<string> {
    return await this.transactionService.withTransaction(async (session) => {
      try {
        // Validate input
        if (!paymentRequest?.items?.length || !paymentRequest.items[0].name) {
          throw new BadRequestException(
            'Invalid payment request: missing items or item name',
          );
        }

        const levelName = paymentRequest.items[0].name as Level_Name;

        // Validate that levelName is a valid enum value
        if (!Object.values(Level_Name).includes(levelName)) {
          throw new BadRequestException(
            `Invalid level name: ${levelName}`,
          );
        }

        // Check for existing completed order using transaction session
        const existingCompletedOrder = await this.orderRepo.findCompletedOrder(userId, levelName, session);

        if (existingCompletedOrder) {
          throw new BadRequestException(
            'User already has this level',
          );
        }

        // Create payment intention
        const dataUserPaymentIntention = await this.createIntention(paymentRequest);
        if (!dataUserPaymentIntention?.client_secret) {
          throw new InternalServerErrorException(
            'Failed to create payment intention',
          );
        }

        // Create or update order record with transaction session
        await this.orderRepo.upsertOrder(
          userId,
          levelName,
          paymentRequest.amount,
          session
        );

        return `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.PAYMOB_PUBLIC_KEY}&clientSecret=${dataUserPaymentIntention.client_secret}`;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
        throw new InternalServerErrorException(
          `Payment processing failed: ${error.message}`,
        );
      }
    });
  }

  /**
   * Handle Paymob callback with transaction support
   * This method signature matches your existing controller implementation
   */
  async handlePaymobCallback(
    orderId: number,
    success: boolean,
    amount: number,
    userEmail: string,
    callbackData?: PaymentPostBodyCallback,
  ): Promise<boolean> {
    return await this.transactionService.withTransaction(async (session) => {
      try {
        // Verify HMAC signature if callback data is provided
        if (callbackData && !this.verifyHmac(callbackData)) {
          this.logger.warn('Invalid HMAC signature in payment callback');
          throw new UnauthorizedException('Invalid HMAC signature');
        }

        if (!userEmail) {
          throw new BadRequestException('User email is required');
        }

        if (!success) {
          this.logger.warn(`Payment failed for order ${orderId}`);
          return false;
        }

        // Find all pending orders with transaction session
        const pendingOrders = await this.orderRepo.find({ 
          paymentStatus: PaymentStatus.PENDING 
        }, session);
        
        if (!pendingOrders || pendingOrders.length === 0) {
          throw new NotFoundException('No pending orders found');
        }

        // Update order status to COMPLETED with transaction session
        const order = pendingOrders[0];
        await this.orderRepo.updateOrderStatus(
          order._id.toString(),
          PaymentStatus.COMPLETED,
          orderId.toString(),
          session
        );

        this.logger.log(`Payment successful for order ${orderId}`);
        return true;
      } catch (error) {
        this.logger.error(`Payment callback failed: ${error.message}`, error.stack);
        throw new InternalServerErrorException(
          `Payment callback failed: ${error.message}`,
        );
      }
    });
  }

  /**
   * Refund an order with transaction support
   */
  async refundOrder(orderId: string): Promise<any> {
    return await this.transactionService.withTransaction(async (session) => {
      try {
        // Implement refund logic using Paymob API
        this.logger.log(`Refunding order ${orderId}`);
        
        const order = await this.orderRepo.findOne({ paymentId: orderId }, session);
        if (!order) {
          throw new NotFoundException(`Order with payment ID ${orderId} not found`);
        }

        // Update order status to REFUNDED with transaction session
        await this.orderRepo.updateOrderStatus(
          order._id.toString(),
          PaymentStatus.REFUNDED,
          undefined,
          session
        );

        return { success: true };
      } catch (error) {
        this.logger.error(`Refund failed: ${error.message}`, error.stack);
        throw new InternalServerErrorException(
          `Refund failed: ${error.message}`,
        );
      }
    });
  }
}
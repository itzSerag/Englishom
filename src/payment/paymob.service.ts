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
import { UserRepo } from '../user/repo/repo.user';
import * as crypto from 'crypto';

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
    private readonly userRepo: UserRepo
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
      this.logger.debug('Creating payment intention with Paymob', {
        amount: paymentRequest.amount,
        items: paymentRequest.items.map(item => item.name)
      });

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
  // verifyHmac(callbackData: any): boolean {
  //   try {
  //     // Extract HMAC from the callback data
  //     const hmacHeader = callbackData.hmac;

  //     if (!hmacHeader) {
  //       this.logger.warn('Missing HMAC in callback data');
  //       return false;
  //     }

  //     this.logger.debug('Verifying HMAC signature', { hmacHeader });

  //     // Create a string to hash according to Paymob's documentation
  //     // Adjust the fields based on Paymob's official documentation
  //     const dataToHash = [
  //       callbackData.obj.id.toString(),
  //       callbackData.obj.amount_cents.toString(),
  //       callbackData.obj.created_at,
  //       callbackData.obj.currency,
  //       callbackData.obj.order.id.toString(),
  //       callbackData.obj.success.toString()
  //     ].join('');

  //     // Calculate HMAC using SHA256
  //     const calculatedHmac = crypto
  //       .createHmac('sha256', this.hmacSecret)
  //       .update(dataToHash)
  //       .digest('hex');

  //     // Compare HMAC values
  //     const isValid = calculatedHmac === hmacHeader;

  //     if (!isValid) {
  //       this.logger.warn('Invalid HMAC signature in callback request');
  //       this.logger.debug(`Calculated: ${calculatedHmac}, Received: ${hmacHeader}`);
  //     } else {
  //       this.logger.debug('HMAC signature verified successfully');
  //     }

  //     return isValid;
  //   } catch (error) {
  //     this.logger.error(`Error verifying HMAC: ${error.message}`, error.stack);
  //     return false;
  //   }
  // }

  /**
   * Process a new order with transaction support
   */
  async processOrder(paymentRequest: PaymentRequest, userId: string): Promise<string> {
    return await this.transactionService.withTransaction(async (session) => {
      try {
        this.logger.debug('Starting order processing', {
          userId,
          amount: paymentRequest.amount,
          items: paymentRequest.items
        });

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
          this.logger.warn('User already has this level', { userId, levelName });
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
        const order = await this.orderRepo.upsertOrder(
          userId,
          levelName,
          paymentRequest.amount,
          session
        );

        this.logger.debug('Order created successfully', {
          orderId: order._id.toString(),
          status: order.paymentStatus
        });

        // Verify the order was created
        const createdOrder = await this.orderRepo.findOne(
          { _id: order._id },
          session
        );

        if (!createdOrder) {
          this.logger.error('Failed to find created order', { orderId: order._id });
          throw new InternalServerErrorException('Failed to create order in database');
        }

        this.logger.debug('Order confirmed in database', {
          orderId: createdOrder._id,
          status: createdOrder.paymentStatus
        });

        return `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.PAYMOB_PUBLIC_KEY}&clientSecret=${dataUserPaymentIntention.client_secret}`;
      } catch (error) {
        // Log the error with all available details
        this.logger.error(
          `Payment processing failed: ${error.message}`,
          error.stack,
          { userId, levelName: paymentRequest?.items?.[0]?.name }
        );

        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new InternalServerErrorException(
          `Payment processing failed: ${error.message}`,
        );
      }
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
    this.logger.debug('Received payment callback', {
      orderId,
      success,
      amount,
      userEmail
    });

    // 
    this.logger.debug('IAM INSIDE THE HANDLE METHOD');
    return await this.transactionService.withTransaction(async (session) => {
      try {
        if (!userEmail) {
          this.logger.warn('Missing user email in callback');
          throw new BadRequestException('User email is required');
        }

        if (!success) {
          this.logger.warn(`Payment failed for order ${orderId}`);

          // For failed payments, find and update the order status to FAILED
          const user = await this.userRepo.findOne({ email: userEmail });
          if (user) {
            const pendingOrder = await this.orderRepo.findOne({
              userId: user._id,
              paymentStatus: PaymentStatus.PENDING,
              amountCents: amount,
            }, session);

            if (pendingOrder) {
              await this.orderRepo.updateOrderStatus(
                pendingOrder._id.toString(),
                PaymentStatus.FAILED,
                orderId.toString(),
                session,
              );

              this.logger.debug('Order status updated to FAILED', {
                orderId: pendingOrder._id.toString()
              });
            }
          }

          return false;
        }

        // Step 1: Get user by email
        const user = await this.userRepo.findOne({ email: userEmail });
        if (!user) {
          this.logger.warn(`No user found with email ${userEmail}`);
          throw new NotFoundException('User not found');
        }

        this.logger.debug('Found user for callback', {
          userId: user._id.toString()
        });

        // Step 2: Find the pending order for this user and amount
        const pendingOrder = await this.orderRepo.findOne({
          userId: user._id,
          paymentStatus: PaymentStatus.PENDING,
          amountCents: amount,
        }, session);

        if (!pendingOrder) {
          this.logger.warn(
            `No matching pending order found for user ${userEmail} with amount ${amount}`,
          );

          // Check if there's an order with same amount but different status
          const existingOrder = await this.orderRepo.findOne({
            userId: user._id,
            amountCents: amount,
          }, session);

          if (existingOrder) {
            this.logger.warn(
              `Found order with non-pending status: ${existingOrder.paymentStatus}`,
              { orderId: existingOrder._id.toString() }
            );
          }

          throw new NotFoundException('No matching pending order found');
        }

        this.logger.debug('Found pending order', {
          orderId: pendingOrder._id.toString(),
          levelName: pendingOrder.levelName
        });

        // Step 3: Update order status to COMPLETED
        await this.orderRepo.updateOrderStatus(
          pendingOrder._id.toString(),
          PaymentStatus.COMPLETED,
          orderId.toString(),
          session,
        );

        this.logger.debug('Order status updated to COMPLETED', {
          orderId: pendingOrder._id.toString()
        });

        // Step 4: Double-check the order was updated
        const updatedOrder = await this.orderRepo.findOne(
          { _id: pendingOrder._id },
          session
        );

        if (updatedOrder?.paymentStatus !== PaymentStatus.COMPLETED) {
          this.logger.error('Order status update failed to persist', {
            orderId: pendingOrder._id.toString(),
            currentStatus: updatedOrder?.paymentStatus
          });
          throw new InternalServerErrorException('Failed to update order status');
        }

        this.logger.log(`Payment successful for order ${orderId}`);
        return true;

      } catch (error) {
        this.logger.error(
          `Payment callback failed: ${error.message}`,
          error.stack,
          { orderId, userEmail, amount }
        );

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
    this.logger.debug('Processing refund request', { orderId });

    return await this.transactionService.withTransaction(async (session) => {
      try {
        // Implement refund logic using Paymob API
        this.logger.log(`Refunding order ${orderId}`);

        const order = await this.orderRepo.findOne({ paymentId: orderId }, session);
        if (!order) {
          this.logger.warn(`Order with payment ID ${orderId} not found`);
          throw new NotFoundException(`Order with payment ID ${orderId} not found`);
        }

        this.logger.debug('Found order for refund', {
          orderId: order._id.toString(),
          paymentId: orderId
        });

        // Here you would add the API call to Paymob for refund processing
        // For example:
        /*
        const refundResult = await fetch('https://accept.paymob.com/api/acceptance/refund', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.PAYMOB_SECRET_KEY}`
          },
          body: JSON.stringify({
            auth_token: this.PAYMOB_SECRET_KEY,
            transaction_id: orderId,
            amount_cents: order.amountCents
          })
        });
        
        const refundData = await refundResult.json();
        if (!refundData.success) {
          throw new InternalServerErrorException(`Refund failed: ${refundData.message}`);
        }
        */

        // Update order status to REFUNDED with transaction session
        await this.orderRepo.updateOrderStatus(
          order._id.toString(),
          PaymentStatus.REFUNDED,
          undefined,
          session
        );

        this.logger.debug('Order status updated to REFUNDED', {
          orderId: order._id.toString()
        });

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
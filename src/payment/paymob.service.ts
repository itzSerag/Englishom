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
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRequest, PaymentStatus } from './types';
import { Level_Name } from '../common/enums';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentPostBodyCallback } from './types/callback';
import { log } from 'console';

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly PAYMOB_SECRET_KEY: string;
  private readonly integrationId: string;
  private readonly hmacSecret: string;
  private readonly PAYMOB_PUBLIC_KEY: string;
  private readonly REQUEST_TIMEOUT = 20000; // 10 seconds timeout

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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

    // 
    log("Here in Callback")
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
  async processOrder(paymentRequest: PaymentRequest, userId: number): Promise<string> {
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

      // If the user has this level already, return an error


      return await this.prisma.$transaction(async (tx) => {
        // Check for existing completed order
        const existingCompletedOrder = await tx.order.findFirst({
          where: {
            userId,
            levelName,
            paymentStatus: PaymentStatus.COMPLETED,
          },
        });

        if (existingCompletedOrder) {
          throw new BadRequestException(
            'Payment already have this level',
          );
        }

        // Create payment intention
        const dataUserPaymentIntention = await this.createIntention(paymentRequest);
        if (!dataUserPaymentIntention?.client_secret) {
          throw new InternalServerErrorException(
            'Failed to create payment intention',
          );
        }

        // Create or update order record
        await tx.order.upsert({
          where: {
            userId_levelName: {
              userId,
              levelName,
            },
          },
          create: {
            userId,
            levelName,
            amountCents: paymentRequest.amount,
            paymentStatus: PaymentStatus.PENDING,
            createdAt: new Date(),
          },
          update: {
            amountCents: paymentRequest.amount,
            paymentStatus: PaymentStatus.PENDING,
            createdAt: new Date(),
          },
        });

        return `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.PAYMOB_PUBLIC_KEY}&clientSecret=${dataUserPaymentIntention.client_secret}`;
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Payment processing failed: ${error.message}`,
      );
    }
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
    callbackData?: PaymentPostBodyCallback, // Optional to maintain backward compatibility
  ): Promise<boolean> {
    try {
      // Verify HMAC signature if callback data is provided
      if (callbackData && !this.verifyHmac(callbackData)) {
        this.logger.warn('Invalid HMAC signature in payment callback');
        throw new UnauthorizedException('Invalid HMAC signature');
      }

      if (!userEmail) {
        throw new BadRequestException('User email is required');
      }

      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { email: userEmail },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const pendingOrder = await tx.order.findFirst({
          where: {
            userId: user.id,
            amountCents: amount,
            paymentStatus: PaymentStatus.PENDING,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (!pendingOrder) {
          throw new NotFoundException('No matching pending order found');
        }

        // Update order status
        const updatedOrder = await tx.order.update({
          where: { id: pendingOrder.id },
          data: {
            paymentStatus: success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
            paymentId: orderId.toString(),
          },
        });

        // If payment successful, grant access to the level
        if (success) {
          await tx.userLevel.create({
            data: {
              userId: user.id,
              levelName: Level_Name[updatedOrder.levelName],
            },
          });

          this.logger.log(`Payment successful for user ${user.id}, level ${updatedOrder.levelName}`);
        } else {
          this.logger.log(`Payment failed for user ${user.id}, level ${updatedOrder.levelName}`);
        }

        return success;
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(`Failed to process payment callback: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to process payment callback: ${error.message}`,
      );
    }
  }

  /**
   * Refund an order with transaction support
   */
  async refundOrder(orderId: string): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Find the order and validate refund eligibility
        const order = await tx.order.findUnique({
          where: { paymentId: orderId, paymentStatus: PaymentStatus.COMPLETED },
        });

        if (!order) {
          throw new NotFoundException('Order not found with the provided order id');
        }

        const REFUND_WINDOW_DAYS = 14;
        const refundCutoffDate = new Date();
        refundCutoffDate.setDate(refundCutoffDate.getDate() - REFUND_WINDOW_DAYS);

        if (order.createdAt < refundCutoffDate) {
          throw new BadRequestException(
            'Order is older than 14 days and cannot be refunded',
          );
        }

        // Process refund with Paymob
        const refundRequest = {
          amount_cents: order.amountCents,
          transaction_id: orderId,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        const res = await fetch(
          'https://accept.paymob.com/api/acceptance/void_refund/refund',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${this.PAYMOB_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(refundRequest),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
          const error = await res.text();
          this.logger.error(`Paymob refund API error: ${error}`);
          throw new HttpException(
            `Failed to refund order: ${error}`,
            HttpStatus.BAD_REQUEST,
          );
        }

        const data = await res.json();

        // If refund is successful, update the order and remove UserLevel
        if (data.success) {
          await tx.order.update({
            where: { paymentId: orderId },
            data: { paymentStatus: PaymentStatus.REFUNDED },
          });

          await tx.userLevel.delete({
            where: {
              userId_levelName: {
                userId: order.userId,
                levelName: order.levelName,
              },
            },
          });

          this.logger.log(`Refund processed successfully for order ${orderId}`);
        } else {
          this.logger.warn(`Refund failed for order ${orderId}`, data);
        }

        return data;
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Payment gateway request timed out during refund',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to refund order: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to refund order: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
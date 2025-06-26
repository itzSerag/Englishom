import { Injectable } from '@nestjs/common';
import { AbstractRepo } from '../../common/database/repo/abstract.repo';
import { Order } from '../models/order.schema';
import { ClientSession, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Level_Name } from '../../common/shared/enums';
import { PaymentStatus } from '../types';
import { OrderService } from '../../common/shared/services/order.service';
import { toObjectId } from '../../common/utils/mongoose.utils';

@Injectable()
export class OrderRepo extends AbstractRepo<Order> implements OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {
    super(orderModel);
  }

  async findPendingOrder(
    userId: string,
    levelName: Level_Name,
    session?: ClientSession,
  ): Promise<Order | null> {
    // Convert userId to ObjectId
    const userIdObjectId = toObjectId(userId);

    return await this.orderModel
      .findOne({
        userId: userIdObjectId,
        levelName,
        paymentStatus: PaymentStatus.PENDING,
      })
      .session(session || null);
  }

  async findCompletedOrder(
    userId: string,
    levelName: Level_Name,
    session?: ClientSession,
  ): Promise<Order | null> {
    // Convert userId to ObjectId
    const userIdObjectId = toObjectId(userId);

    return await this.orderModel
      .findOne({
        userId: userIdObjectId,
        levelName,
        paymentStatus: PaymentStatus.COMPLETED,
      })
      .session(session || null)
      .sort({ createdAt: -1 }); // Get the most recent completed order
  }

  async findUserCompletedOrders(
    userId: string,
    session?: ClientSession,
  ): Promise<Order[]> {
    // Convert userId to ObjectId
    const userIdObjectId = toObjectId(userId);

    return await this.orderModel
      .find({
        userId: userIdObjectId,
        paymentStatus: PaymentStatus.COMPLETED,
      })
      .session(session || null);
  }

  async updateOrderStatus(
    orderId: string,
    status: PaymentStatus,
    paymentId?: string,
    session?: ClientSession,
  ): Promise<Order | null> {
    // Convert orderId to ObjectId
    const orderIdObjectId = toObjectId(orderId);

    const updateData: any = { paymentStatus: status };
    if (paymentId) {
      updateData.paymentId = paymentId;
    }

    return await this.orderModel.findByIdAndUpdate(
      orderIdObjectId,
      updateData,
      { new: true, session: session || null },
    );
  }

  async upsertOrder(
    userId: string,
    levelName: Level_Name,
    amountCents: number,
    session?: ClientSession,
  ): Promise<Order> {
    try {
      // Convert userId to ObjectId
      const userIdObjectId = toObjectId(userId);

      // Check if there's already a pending order for this user and level
      const existingPendingOrder = await this.orderModel
        .findOne({
          userId: userIdObjectId,
          levelName,
          paymentStatus: PaymentStatus.PENDING,
        })
        .session(session || null);

      if (existingPendingOrder) {
        // Update the existing pending order
        const updatedOrder = await this.orderModel.findByIdAndUpdate(
          existingPendingOrder._id,
          {
            amountCents,
            paymentDate: new Date(),
          },
          { new: true, session: session || null },
        );

        if (!updatedOrder) {
          throw new Error('Failed to update existing pending order');
        }

        return updatedOrder;
      }

      // Create a new order if no pending order exists using the AbstractRepo's create method
      const newOrder = await this.create(
        {
          userId: userIdObjectId as any, // Cast to avoid TypeScript issues with ObjectId vs User
          levelName,
          amountCents,
          paymentStatus: PaymentStatus.PENDING,
          paymentDate: new Date(),
        },
        session,
      );

      if (!newOrder) {
        throw new Error('Failed to create new order');
      }

      return newOrder;
    } catch (error) {
      this.logger.error(`Error in upsertOrder: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findMostRecentOrder(
    userId: string,
    levelName?: Level_Name,
    session?: ClientSession,
  ): Promise<Order | null> {
    // Convert userId to ObjectId
    const userIdObjectId = toObjectId(userId);

    const filter: any = { userId: userIdObjectId };
    if (levelName) {
      filter.levelName = levelName;
    }

    return await this.orderModel
      .findOne(filter)
      .session(session || null)
      .sort({ createdAt: -1 });
  }
}

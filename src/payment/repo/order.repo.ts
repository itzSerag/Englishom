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
      .session(session || null);
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
    // Convert userId to ObjectId
    const userIdObjectId = toObjectId(userId);

    const order = await this.orderModel.findOneAndUpdate(
      { userId: userIdObjectId, levelName },
      {
        userId: userIdObjectId,
        levelName,
        amountCents,
        paymentStatus: PaymentStatus.PENDING,
        paymentDate: new Date(),
      },
      { new: true, upsert: true, session: session || null },
    );

    return order;
  }
}

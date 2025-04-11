import { Injectable } from "@nestjs/common";
import { AbstractRepo } from "src/common/database/repo/abstract.repo";
import { Order } from "../models/order.schema";
import { ClientSession, Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { Level_Name } from "src/common/shared/enums";
import { PaymentStatus } from "../types";
import { OrderService } from "src/common/shared/services/order.service";

@Injectable()
export class OrderRepo extends AbstractRepo<Order> implements OrderService {
    constructor(
        @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    ) {
        super(orderModel);
    }

    async findPendingOrder(userId: string, levelName: Level_Name, session?: ClientSession): Promise<Order | null> {
        return await this.orderModel.findOne({
            userId,
            levelName,
            paymentStatus: PaymentStatus.PENDING
        }).session(session || null);
    }

    async findCompletedOrder(userId: string, levelName: Level_Name, session?: ClientSession): Promise<Order | null> {
        return await this.orderModel.findOne({
            userId,
            levelName,
            paymentStatus: PaymentStatus.COMPLETED
        }).session(session || null);
    }

    async findUserCompletedOrders(userId: string, session?: ClientSession): Promise<Order[]> {
        return await this.orderModel.find({
            userId,
            paymentStatus: PaymentStatus.COMPLETED
        }).session(session || null);
    }

    async updateOrderStatus(orderId: string, status: PaymentStatus, paymentId?: string, session?: ClientSession): Promise<Order | null> {
        const updateData: any = { paymentStatus: status };
        if (paymentId) {
            updateData.paymentId = paymentId;
        }

        return await this.orderModel.findByIdAndUpdate(
            orderId,
            updateData,
            { new: true, session: session || null }
        );
    }

    async upsertOrder(userId: string, levelName: Level_Name, amountCents: number, session?: ClientSession): Promise<Order> {
        const order = await this.orderModel.findOneAndUpdate(
            { userId, levelName },
            { 
                userId,
                levelName,
                amountCents,
                paymentStatus: PaymentStatus.PENDING,
                paymentDate: new Date()
            },
            { new: true, upsert: true, session: session || null }
        );
        
        return order;
    }
} 
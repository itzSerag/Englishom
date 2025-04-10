import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Level_Name } from 'src/common/shared/enums';
import { PaymentStatus } from '../types';
import { User } from 'src/user/models/user.schema';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    userId: User;

    @Prop({ type: String, enum: Level_Name, required: true })
    levelName: Level_Name;

    @Prop({ required: true })
    amountCents: number;

    @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
    paymentStatus: PaymentStatus;

    @Prop({ default: Date.now })
    paymentDate: Date;

    @Prop({ unique: true, sparse: true })
    paymentId?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Create a unique compound index for userId and levelName
OrderSchema.index({ userId: 1, levelName: 1 }, { unique: true });
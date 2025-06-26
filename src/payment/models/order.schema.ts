import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Level_Name } from '../../common/shared/enums';
import { PaymentStatus } from '../types';
import { User } from '../../user/models/user.schema';
import { AbstractDocument } from '../../common/database/abstract.schema';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order extends AbstractDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
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

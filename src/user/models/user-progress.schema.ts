import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { Day } from './day.schema';

export type UserProgressDocument = UserProgress & Document;

@Schema()
export class UserProgress {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Day', required: true })
  dayId: Day;

  @Prop({ default: false })
  completed: boolean;

  @Prop()
  completedAt?: Date;
}

export const UserProgressSchema = SchemaFactory.createForClass(UserProgress);

UserProgressSchema.index({ userId: 1, dayId: 1 }, { unique: true });

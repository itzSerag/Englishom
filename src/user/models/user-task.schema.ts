import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { Task } from './task.schema';

export type UserTaskDocument = UserTask & Document;

@Schema()
export class UserTask {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task', required: true })
  taskId: Task;

  @Prop({ default: false })
  completed: boolean;

  @Prop()
  completedAt?: Date;
}

export const UserTaskSchema = SchemaFactory.createForClass(UserTask);

// Create a unique compound index for userId and taskId
UserTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

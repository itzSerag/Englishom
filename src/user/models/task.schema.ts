import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Day } from './day.schema';

export type TaskDocument = Task & Document;

@Schema()
export class Task {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Day', required: true })
  dayId: Day;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Create a unique compound index for dayId and name
TaskSchema.index({ dayId: 1, name: 1 }, { unique: true });

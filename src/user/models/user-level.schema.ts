import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { Level_Name } from '../../common/shared/enums';

export type UserLevelDocument = UserLevel & Document;

@Schema()
export class UserLevel {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: String, enum: Level_Name, required: true })
  levelName: Level_Name;
}

export const UserLevelSchema = SchemaFactory.createForClass(UserLevel);

// Create a unique compound index for userId and levelName
UserLevelSchema.index({ userId: 1, levelName: 1 }, { unique: true });

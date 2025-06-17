import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { User } from './user.schema';
import { Types } from 'mongoose';
import { Level_Name } from '../../common/shared/enums';
import { AbstractDocument } from '../../common/database/abstract.schema';

@Schema({ timestamps: true })
export class Certification extends AbstractDocument {
  @Prop({ required: true, ref: User.name })
  userId: Types.ObjectId;

  @Prop({ required: true, type: String })
  certificateId: string;

  @Prop({ required: true, enum: Level_Name })
  level_name: Level_Name;
}

export const CertificationSchema = SchemaFactory.createForClass(Certification);
CertificationSchema.index({ userId: 1, level_name: 1 }, { unique: true });

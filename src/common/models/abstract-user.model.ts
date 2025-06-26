import { Prop } from '@nestjs/mongoose';
import { AbstractDocument } from '../database/abstract.schema';

export abstract class AbstractUser extends AbstractDocument {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    type: Date,
    default: Date.now,
  })
  lastActivity: Date;

  @Prop({ type: String, default: 'unknown' })
  country: string;
}

import { Prop } from '@nestjs/mongoose';
import { AbstractDocument } from '../database/abstract.schema';
import * as moment from 'moment-timezone';

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
    default: () => moment.tz('Asia/Riyadh').toDate(),
  })
  lastActivity: Date;

  @Prop({ type: String, default: 'unknown' })
  country: string;
}

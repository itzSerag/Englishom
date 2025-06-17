// src/modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Role } from '../../common/shared';
import { AbstractDocument } from '../../common/database/abstract.schema';
import { TimeService } from 'src/common/config/time.service';


@Schema({ timestamps: true, versionKey: false })
export class User extends AbstractDocument {
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
    default: (timeService: TimeService) => timeService.now(),
  })
  lastActivity: Date;

  // @Prop({ default: 'NA', unique: true })
  // phoneNumber: string;

  @Prop({ default: 'NA' })
  country: string;

  @Prop({ default: 'NA' })
  city: string;

  @Prop({ default: 'local' })
  strategy: string;

  @Prop({ enum: Role, default: Role.USER })
  role: Role;

  @Prop({ default: false })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

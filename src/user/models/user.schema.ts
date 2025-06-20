// src/modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Role } from '../../common/shared';
import { AbstractUser } from '../../common/models/abstract-user.model';
import { Strategy } from 'src/common/shared/enums';

@Schema({ timestamps: true, versionKey: false })
export class User extends AbstractUser {


  @Prop({ enum : Strategy ,  default: Strategy.LOCAL , required: true })
  strategy: Strategy;

  @Prop({ type : Boolean ,default: false })
  isVerified: boolean;

  @Prop({ enum: Role, default: Role.USER })
  role: Role;

}

export const UserSchema = SchemaFactory.createForClass(User);

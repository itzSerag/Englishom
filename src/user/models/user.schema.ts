// src/modules/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Role } from '../../common/shared';
import { AbstractUser } from '../../common/models/abstract-user.model';

@Schema({ timestamps: true, versionKey: false })
export class User extends AbstractUser {
  // @Prop({ default: 'NA', unique: true })
  // phoneNumber: string;

  @Prop({ default: 'local' })
  strategy: string;

  @Prop({ enum: Role, default: Role.USER })
  role: Role;

  // Implementation of abstract methods
  getUserType(): 'admin' | 'user' {
    return 'user';
  }

  getRole(): string {
    return this.role;
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

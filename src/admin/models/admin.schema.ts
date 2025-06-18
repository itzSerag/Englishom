import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AdminRole, Role } from '../../common/shared';
import { AbstractUser } from '../../common/models/abstract-user.model';
import { Types } from 'mongoose';
import { Strategy } from 'src/common/shared/enums';

@Schema({ timestamps: true, versionKey: false })
export class Admin extends AbstractUser {
  @Prop({ enum: AdminRole, default: AdminRole.VIEW })
  adminRole: AdminRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({enum : Role, default: Role.ADMIN , required: false})
  role?: Role = Role.ADMIN;

  @Prop({ type: Types.ObjectId, ref: 'Admin' })
  createdBy?: Types.ObjectId; // Track who created this admin

  @Prop({enum: Strategy, default: Strategy.LOCAL , required: false})
  strategy?: Strategy;

  // Implementation of abstract methods
  getUserType(): 'admin' | 'user' {
    return 'admin';
  }

  getRole(): string {
    return this.role;
  }
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

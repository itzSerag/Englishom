import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AdminRole, Role } from '../../common/shared';
import { AbstractUser } from '../../common/models/abstract-user.model';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Admin extends AbstractUser {
  @Prop({ enum: AdminRole, default: AdminRole.VIEW })
  adminRole: AdminRole;

  @Prop({ enum: Role, default: Role.ADMIN })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Admin', default: null })
  createdBy: Types.ObjectId; // Track who created this admin
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

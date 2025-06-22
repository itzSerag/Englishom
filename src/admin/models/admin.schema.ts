import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AdminRole } from '../../common/shared';
import { AbstractUser } from '../../common/models/abstract-user.model';
import { Types } from 'mongoose';



@Schema({ timestamps: true, versionKey: false })
export class Admin extends AbstractUser {

  @Prop({ enum: AdminRole, default: AdminRole.VIEW })
  adminRole: AdminRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Admin' })
  createdBy?: Types.ObjectId; // Track who created this admin
}


export const AdminSchema = SchemaFactory.createForClass(Admin);

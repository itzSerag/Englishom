import { Exclude, Expose, Type } from 'class-transformer';
import { AdminRole } from '../../common/shared';

export class AdminDto {
  @Expose()
  _id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Exclude()
  password: string;

  @Expose()
  role: AdminRole;

  @Expose()
  isActive: boolean;

  @Expose()
  isVerified: boolean;

  @Expose()
  country?: string;

  @Expose()
  city?: string;

  @Expose()
  lastActivity: Date;

  @Expose()
  lastLoginAt?: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  createdBy?: string;

  constructor(partial: Partial<AdminDto>) {
    Object.assign(this, partial);
  }
}

import { Exclude, Expose, Transform } from 'class-transformer';
import { IsMongoId } from 'class-validator';
import { Role } from '../enums'; // Adjust path if needed

export class UserDto {
  @IsMongoId()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() || obj.id)
  id: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  email: string;

  @Expose()
  role: Role;

  @Expose()
  strategy?: String

  @Expose()
  lastLoginAt?: Date

  @Expose()
  country?: string;

  @Expose()
  city?: string;

  @Expose()
  isVerified?: boolean;

  @Expose()
  createdAt: Date | string;

  @Expose()
  updatedAt: Date | string;

  @Exclude()
  password: string;

  @Exclude()
  _id?: any;

  constructor(partial: Partial<UserDto>) {
    if (partial) {
      // If we have _id, convert it to id string
      if (partial._id) {
        this.id = partial._id.toString();
      }

      // Copy all other exposed properties
      Object.assign(this, partial);
    }
  }
}

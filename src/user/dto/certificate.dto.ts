import { Exclude, Expose, Transform } from 'class-transformer';
import { IsMongoId } from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class CertificateDto {
  @IsMongoId()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() || obj.id)
  id: string;

  @IsMongoId()
  @Expose()
  @Transform(({ obj }) => obj.userId?.toString() || obj.id)
  user_id: string;

  @Expose()
  certificateId: string;

  @Expose()
  level_name: Level_Name | string;

  @Expose()
  createdAt: Date | string;

  @Expose()
  updatedAt: Date | string;

  @Exclude()
  _id?: any;

  @Exclude()
  userId?: any;

  constructor(partial: Partial<CertificateDto>) {
    if (partial) {
      // If we have _id, convert it to id string
      if (partial._id) {
        this.id = partial._id.toString();
      }
      if (partial.userId) {
        this.user_id = partial.userId.toString();
      }

      // Copy all other exposed properties
      Object.assign(this, partial);
    }
  }
}

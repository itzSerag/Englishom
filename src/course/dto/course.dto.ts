import { Exclude, Expose, Transform } from 'class-transformer';
import { IsMongoId } from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class CourseDto {
  @IsMongoId()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString() || obj.id)
  id: string;

  @Exclude()
  _id?: any;

  @Expose()
  level_name: Level_Name;

  @Expose()
  titleAr: string;

  @Expose()
  descriptionAr: string;

  @Expose()
  titleEn: string;

  @Expose()
  descriptionEn: string;

  @Expose()
  price: number;

  constructor(partial: Partial<CourseDto>) {
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

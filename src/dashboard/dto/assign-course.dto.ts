import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class AssignCourseDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsEnum(Level_Name)
  @IsNotEmpty()
  level_name: Level_Name;

  @IsString()
  @IsOptional()
  reason?: string;
}

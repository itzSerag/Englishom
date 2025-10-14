import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class UpdateCourseDto {
  @IsEnum(Level_Name)
  @IsNotEmpty()
  level_name: Level_Name;

  @IsString()
  @IsOptional()
  titleAr?: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  // the price but be not minus value
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

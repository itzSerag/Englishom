import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Level_Name } from 'src/common/shared/enums';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  @IsNotEmpty()
  @IsString()
  titleAr: string;

  @IsNotEmpty()
  @IsString()
  titleEn: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;
}

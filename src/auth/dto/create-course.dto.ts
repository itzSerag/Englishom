import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Level_Name } from 'src/common/shared/enums';

export class CreateCourseDto {
  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;
} 
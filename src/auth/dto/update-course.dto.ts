import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {

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
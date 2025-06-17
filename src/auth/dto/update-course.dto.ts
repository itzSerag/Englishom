import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
  @IsNotEmpty()
  @IsString()
  @IsOptional()
  titleAr?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  price?: number;
}

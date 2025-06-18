import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { AdminRole } from '../../common/shared';

export class CreateAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole = AdminRole.VIEW;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;
}

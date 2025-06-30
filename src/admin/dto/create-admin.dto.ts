import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { AdminRole, Role } from '../../common/shared';

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

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  adminRole?: AdminRole;
}

import {
  IsEmail,
  IsIP,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 20)
  password: string;

  // will set country based on IP address during signup
  @IsString()
  @IsOptional()
  country?: string;

  @IsIP()
  @IsOptional()
  ipAddress?: string;
}

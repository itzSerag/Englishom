import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { OtpCause } from '../enum/otp-cause.enum';

export class ResetPasswordWithOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  otp: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;

  @IsEnum(OtpCause, {
    message: 'Cause must be either email_verification or forget_password',
  })
  @IsNotEmpty()
  cause: OtpCause;
}

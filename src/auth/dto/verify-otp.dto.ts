import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { OtpCause } from '../enum/otp-cause.enum';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  otp: string;

  @IsEnum(OtpCause, {
    message: 'Cause must be either email_verification or forget_password',
  })
  @IsNotEmpty()
  cause: OtpCause;
}

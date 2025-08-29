import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { OtpCause } from '../enum/otp-cause.enum';

export class ResendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OtpCause, {
    message: 'Cause must be either email_verification or forget_password',
  })
  @IsOptional()
  cause?: OtpCause;
}

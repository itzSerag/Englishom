import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { OtpCause } from '../enum/otp-cause.enum';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsOptional()
  @IsEnum(OtpCause, {
    message: 'Cause must be either email_verification or forget_password',
  })
  cause?: OtpCause;
}

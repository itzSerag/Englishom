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
  @IsEnum(OtpCause)
  cause?: OtpCause = OtpCause.EMAIL_VERIFICATION;
}

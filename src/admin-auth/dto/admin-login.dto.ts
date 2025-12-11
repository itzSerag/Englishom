import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthMessages } from '../../common/shared/const';

export class AdminLoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: AuthMessages.RESET_TOKEN_UNACCEPTED })
  password: string;
}

import { IsEmail, IsNotEmpty, Validate } from 'class-validator';

export class ForgetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

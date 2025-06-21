import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 20)
  oldPassword: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 20)
  newPassword: string;
}

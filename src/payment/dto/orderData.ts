import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class PaymentRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  @IsString()
  @IsNotEmpty()
  phone_number: '00000000000';

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

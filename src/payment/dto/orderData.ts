import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Level_Name } from 'src/common/shared/enums';

export class PaymentRequestDTO {
  @IsString()
  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

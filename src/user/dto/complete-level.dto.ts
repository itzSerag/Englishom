import { IsEnum, IsString } from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class CompleteLevelDto {
  @IsString()
  @IsEnum(Level_Name)
  level_name: Level_Name;
}

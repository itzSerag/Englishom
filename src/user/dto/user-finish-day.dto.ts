import { IsEnum, IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import { Level_Name } from '../../common/shared/enums';

export class UserFinishDayDto {
  @IsNotEmpty()
  @IsEnum(Level_Name)
  levelName: Level_Name;

  @IsInt()
  @Min(1, { message: 'Day must be a positive number' })
  @Max(50, { message: 'Day cannot be greater than 50' })
  day: number;
}

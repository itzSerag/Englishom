import { IsEnum, IsNotEmpty } from 'class-validator';
import { Level_Name } from 'src/common/shared/enums';

export class GetCompletedDaysDto {

    @IsNotEmpty()
    @IsEnum(Level_Name)
    levelName: Level_Name;
}
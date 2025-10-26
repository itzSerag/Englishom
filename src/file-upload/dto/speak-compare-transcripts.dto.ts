import { IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Level_Name } from '../../common/shared/enums';

export class SpeakCompareTranscriptsDto {

  @Type(() => String)
  @IsEnum(Level_Name)
  level_name: Level_Name

  @Type(() => String)
  @IsString()
  sentenceText: string;
}
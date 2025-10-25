import { IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { LESSONS, Level_Name } from '../../common/shared/enums';

export class SpeakCompareTranscriptsDto {

  @Type(() => String)
  @IsEnum(Level_Name)
  level_name: Level_Name

  @Type(() => Number)
  @IsNumber()
  day: number;

  @Type(() => String)
  @IsEnum(LESSONS)
  lesson_name: LESSONS;

  @Type(() => Number)
  @IsNumber()
  sentenceIndex: number;
}
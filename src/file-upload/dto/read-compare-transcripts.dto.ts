import { IsEnum  , IsString } from "class-validator";
import { LESSONS, Level_Name } from "../../common/shared/enums";


export class SpeakCompareTranscriptsDto{

    // see the level, day, lesson

    @IsEnum(Level_Name)
    level_name: Level_Name;
   
    @IsString()
    day: number;

    // What is the lesson name?
    @IsEnum(LESSONS)
    lesson_name: LESSONS;

    // Which sentence index (0-based) is the user speaking?
    // OTHER MEANS: which sentence do i compare with
    @IsString()
    sentenceIndex: number;

}
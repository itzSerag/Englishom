import { IsEnum , IsNumber , Max, Min } from "class-validator";
import { LESSONS, Level_Name } from "../../common/shared/enums";


export class SpeakCompareTranscriptsDto{

    // see the level, day, lesson

    @IsEnum(Level_Name)
    level_name: Level_Name;

    // make the day from 1 to 50
    @IsNumber()
    @Min(1)
    @Max(50)
    day: number;

    // What is the lesson name?
    @IsEnum(LESSONS)
    lesson_name: LESSONS;

    // Which sentence index (0-based) is the user speaking?
    @IsNumber()
    @Min(0)
    sentenceIndex: number;

    // handle the file upload in multer -- the controller 

}
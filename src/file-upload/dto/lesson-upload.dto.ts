import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  validate,
  ValidateNested,
  ValidationError,
} from 'class-validator';
import { Level_Name, QuestionType, LESSONS } from '../../common/shared/enums';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance, Type, ClassConstructor } from 'class-transformer';

// SUB DTOs
class Instructions {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  @IsNotEmpty()
  definition: string;
}

class Sentence {
  @IsString()
  @IsNotEmpty()
  sentence: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;
}

class UseCase {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  en: Array<string>;

  @IsArray()
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  ar: Array<string>;
}

class Definition {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  @IsNotEmpty()
  definition: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;
}

class Answer {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

class Example {
  @IsString()
  @IsNotEmpty()
  exampleAr: string;

  @IsString()
  @IsNotEmpty()
  exampleEn: string;

  @IsString()
  @IsNotEmpty()
  sentence: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;

  @IsString()
  @IsNotEmpty()
  pictureSrc: string;
}

// Main DTO
export class UploadDTO {
  @IsNotEmpty()
  @IsEnum(LESSONS)
  lesson_name: LESSONS;

  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  // Only allows day from 1 to 50
  @IsNotEmpty()
  @Matches(/^([1-9]|[1-4][0-9]|50)$/)
  day: string;

  @IsNotEmpty()
  @IsArray()
  data: any[];
}

export class UploadJsonFileDTO {
  @IsNotEmpty()
  @IsEnum(LESSONS)
  lesson_name: LESSONS;

  @IsNotEmpty()
  @IsEnum(Level_Name)
  level_name: Level_Name;

  @IsNotEmpty()
  // matches days from 1 to 50 only
  @Matches(/^([1-9]|[1-4][0-9]|50)$/)
  day: string;
}

// Validation classes
class READ {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;

  @IsString()
  @IsNotEmpty()
  transcript: string;
}

class WRITE {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  sentences: Array<string>;
}

class TODAY {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  soundSrc?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  sentences: Array<string>;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Instructions)
  instructions: Instructions[];
}

class PICTURES {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;

  @IsString()
  @IsNotEmpty()
  pictureSrc: string;

  @IsString()
  @IsNotEmpty()
  wordEn: string;

  @IsString()
  @IsNotEmpty()
  definition: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  examples: Array<string>;
}

class LISTEN {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;

  @IsString()
  @IsNotEmpty()
  transcript: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Definition)
  definitions: Definition[];
}

class Q_A {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsString()
  @IsNotEmpty()
  questionSrc: string;

  @IsString()
  @IsNotEmpty()
  answerSrc: string;
}

class SPEAK {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsArray()
  @IsNotEmpty({ each: true })
  @ValidateNested({ each: true })
  @Type(() => Sentence)
  sentences: Sentence[];
}

class GRAMMAR {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  nameEn: string;

  @IsString()
  @IsNotEmpty()
  nameAr: string;

  @IsString()
  @IsNotEmpty()
  definitionEn: string;

  @IsString()
  @IsNotEmpty()
  definitionAr: string;

  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => UseCase)
  useCases: UseCase;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  examples: Array<string>;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  words?: Array<string>;

  @IsOptional()
  @IsString()
  notes?: string;
}

class PHRASAL_VERBS {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  exampleAr: string;

  @IsString()
  @IsNotEmpty()
  exampleEn: string;

  @IsString()
  @IsNotEmpty()
  sentence: string;

  @IsString()
  @IsNotEmpty()
  soundSrc: string;

  @IsString()
  @IsNotEmpty()
  pictureSrc: string;
}

class DAILY_TEST {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(QuestionType)
  type: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Answer)
  answers: Answer[];

  @IsString()
  @IsNotEmpty()
  question: string;
}

class IDIOMS {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  definitionEn: string;

  @IsString()
  @IsNotEmpty()
  definitionAr: string;

  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => UseCase)
  useCases: UseCase;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Example)
  examples: Example[];
}

// Type-safe mapping from key to validation class
const validationMap: Record<LESSONS, ClassConstructor<any>> = {
  [LESSONS.READ]: READ,
  [LESSONS.WRITE]: WRITE,
  [LESSONS.PICTURES]: PICTURES,
  [LESSONS.LISTEN]: LISTEN,
  [LESSONS.Q_A]: Q_A,
  [LESSONS.SPEAK]: SPEAK,
  [LESSONS.GRAMMAR]: GRAMMAR,
  [LESSONS.DAILY_TEST]: DAILY_TEST,
  [LESSONS.IDIOMS]: IDIOMS,
  [LESSONS.PHRASAL_VERBS]: PHRASAL_VERBS,
  [LESSONS.TODAY]: TODAY,
};

export async function validateData(
  key: LESSONS,
  data: any[],
): Promise<boolean> {
  const ValidatorClass = validationMap[key];

  if (!ValidatorClass) {
    throw new Error(`No validation schema found for key: ${key}`);
  }

  const validationErrors: ValidationError[] = [];

  // Validate each item in the data array
  for (const item of data) {
    // Special transformation only for IDIOMS which has nested Example objects
    let instance;
    if (key === LESSONS.IDIOMS) {
      const transformedItem = {
        ...item,
        examples: Array.isArray(item.examples)
          ? item.examples.map((ex) => (typeof ex === 'object' ? ex : {}))
          : [],
      };
      instance = plainToInstance(ValidatorClass, transformedItem);
    } else {
      instance = plainToInstance(ValidatorClass, item);
    }

    const errors = await validate(instance);
    if (errors.length > 0) {
      validationErrors.push(...errors);
    }
  }

  if (validationErrors.length > 0) {
    throw new BadRequestException(
      'Please fill the data in a proper way as documented',
    );
  }

  return true;
}

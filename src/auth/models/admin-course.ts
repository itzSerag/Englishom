import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Level_Name } from 'src/common/shared/enums';
import { AbstractDocument } from '../../common/database/abstract.schema';

@Schema({ timestamps: true })
export class Course extends AbstractDocument {

  @Prop({ required: true, unique: true, enum: Level_Name })
  level_name: Level_Name

  @Prop({ required: true })
  title: string;

  @Prop({ type: String })
  description: string;

  @Prop({ required: true, type: Number })
  price: number;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    stage_1_description: string;

    @Prop({ required: true })
    stage_2_description: string;

    @Prop({ required: true })
    price: number;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
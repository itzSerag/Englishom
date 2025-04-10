import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from 'src/common/database/abstract.schema';
import { Level_Name } from 'src/common/shared/enums';


@Schema()
export class Day extends AbstractDocument {
    @Prop({ required: true })
    dayNumber: number;

    @Prop({ type: String, enum: Level_Name, required: true })
    levelName: Level_Name;
}

export const DaySchema = SchemaFactory.createForClass(Day);

DaySchema.index({ levelName: 1, dayNumber: 1 }, { unique: true });

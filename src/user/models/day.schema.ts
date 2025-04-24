import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../common/database/abstract.schema';
import { Level_Name } from '../../common/shared/enums';

@Schema()
export class Day extends AbstractDocument {
  @Prop({ required: true, type: Number })
  dayNumber: number;

  @Prop({ type: String, enum: Level_Name, required: true })
  levelName: Level_Name;
}

export const DaySchema = SchemaFactory.createForClass(Day);

// Create a unique compound index for levelName and dayNumber
DaySchema.index({ levelName: 1, dayNumber: 1 }, { unique: true });

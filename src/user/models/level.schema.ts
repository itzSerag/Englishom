import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '../../common/database/abstract.schema';
import { Level_Name } from '../../common/shared/enums';

@Schema()
export class Level extends AbstractDocument {
  @Prop({ type: String, enum: Level_Name, required: true, unique: true })
  id_name: Level_Name;
}

export const LevelSchema = SchemaFactory.createForClass(Level);

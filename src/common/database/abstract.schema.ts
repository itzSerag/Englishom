import { Prop, Schema, SchemaFactory, } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AbstractDocument {

    @Prop({ type: SchemaTypes.ObjectId, required: true })
    _id: Types.ObjectId;
}

export const AbstractSchema = SchemaFactory.createForClass(AbstractDocument);
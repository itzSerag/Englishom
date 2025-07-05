import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

@Schema({
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      ret._id = ret._id.toString();
      return ret;
    },
  },
})
export class AbstractDocument {
  @Prop({ type: SchemaTypes.ObjectId, required: true })
  _id: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AbstractSchema = SchemaFactory.createForClass(AbstractDocument);

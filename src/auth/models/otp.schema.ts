import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Otp {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    otp: string;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
// Set expiration for OTP documents (10 minutes)
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
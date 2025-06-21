import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { OtpCause } from '../enum/otp-cause.enum';

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true, enum: OtpCause })
  cause: OtpCause;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
// Set expiration for OTP documents (10 minutes)
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
// Create compound unique index to prevent duplicate OTPs for same email+cause
OtpSchema.index({ email: 1, cause: 1 }, { unique: true });

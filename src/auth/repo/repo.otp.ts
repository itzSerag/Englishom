import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Otp } from '../models/otp.schema';

@Injectable()
export class OtpRepo {
  constructor(@InjectModel(Otp.name) private readonly otpModel: Model<Otp>) {}

  async create(data: Partial<Otp>): Promise<Otp> {
    const createdOtp = new this.otpModel(data);
    return createdOtp.save();
  }

  async findOne(filter = {}): Promise<Otp> {
    return this.otpModel.findOne(filter).exec();
  }

  async delete(filter = {}): Promise<any> {
    return this.otpModel.deleteOne(filter).exec();
  }

  async deleteMany(filter = {}): Promise<any> {
    return this.otpModel.deleteMany(filter).exec();
  }

  async deleteByEmailAndCause(email: string, cause: string): Promise<any> {
    return this.otpModel.deleteOne({ email, cause }).exec();
  }

  async deleteAllByEmail(email: string): Promise<any> {
    return this.otpModel.deleteMany({ email }).exec();
  }
}

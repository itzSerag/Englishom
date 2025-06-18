import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../../common/database/repo/abstract.repo';
import { Admin } from '../models/admin.schema';

@Injectable()
export class AdminRepo extends AbstractRepo<Admin> {
  constructor(@InjectModel(Admin.name) private readonly adminModel: Model<Admin>) {
    super(adminModel);
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.findOne({ email });
  }

  async findActiveAdmins(): Promise<Admin[]> {
    return this.find({ isActive: true });
  }

  async countAdminsByRole(role: string): Promise<number> {
    return this.adminModel.countDocuments({ adminRole: role, isActive: true });
  }

  async countAllAdmins(){
    return await this.adminModel.countDocuments();
  }
}

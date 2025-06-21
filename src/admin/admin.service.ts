import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminRepo } from './repo/admin.repo';
import { CreateAdminDto, UpdateAdminDto } from './dto';
import { Admin } from './models/admin.schema';
import { AdminRole } from '../common/shared';
import { Types } from 'mongoose';
import { IpService } from 'src/common/services/ip.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepo,
    private readonly jwtService: JwtService,
    private readonly ipService: IpService,
  ) {}

  // Create new admin (only SUPER admin can create other admins)
  async createAdmin(
    createAdminDto: CreateAdminDto,
    currentAdmin: Admin,
    ipAddress?: string, // Optional IP address for logging
  ): Promise<Admin> {
    // Only SUPER admin can create other admins
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      throw new ForbiddenException('Only Super Admin can create new admins');
    }

    // Check if admin already exists
    const existingAdmin = await this.adminRepo.findByEmail(
      createAdminDto.email,
    );
    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    // Set country based on IP address during signup
    if (ipAddress) {
      const country = this.ipService.getCountryFromIp(ipAddress);
      createAdminDto.country = country;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    // Create admin
    const admin = await this.adminRepo.create({
      ...createAdminDto,
      password: hashedPassword,
      createdBy: currentAdmin._id,
      isActive: true,
    });

    return admin;
  }

  // Get all admins (SUPER and MANAGER can view all)
  async getAllActiveAdmins(): Promise<Admin[]> {
    return this.adminRepo.findActiveAdmins();
  }
  async getAllAdmins(): Promise<Admin[]> {
    // no need for pagination there wont be many admins
    return this.adminRepo.finaAllAdmins();
  }

  // Get admin by ID
  async getAdminById(id: string): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ _id: new Types.ObjectId(id) });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  // Update admin (SUPER can update anyone, others can only update themselves)
  async updateAdmin(
    id: string,
    updateAdminDto: UpdateAdminDto,
    currentAdmin: Admin,
  ): Promise<Admin> {
    const targetAdmin = await this.adminRepo.findOne({ _id: id });

    if (!targetAdmin) {
      throw new NotFoundException('Admin not found');
    }

    // SUPER admin can update anyone
    // Others can only update themselves (except role changes)
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      if (currentAdmin._id.toString() !== id) {
        throw new ForbiddenException('You can only update your own profile');
      }

      // Non-SUPER admins cannot change roles or activation status
      if (
        updateAdminDto.adminRole ||
        updateAdminDto.hasOwnProperty('isActive')
      ) {
        throw new ForbiddenException(
          'You cannot change role or activation status',
        );
      }
    }

    // Prevent deactivating the last SUPER admin
    if (
      updateAdminDto.isActive === false &&
      targetAdmin.adminRole === AdminRole.SUPER
    ) {
      throw new BadRequestException('Cannot deactivate Super Admin');
    }

    // Hash password if provided
    if (updateAdminDto.password) {
      updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 10);
    }

    const updatedAdmin = await this.adminRepo.findOneAndUpdate(
      { _id: id },
      { ...updateAdminDto, lastActivity: new Date() },
    );

    return updatedAdmin;
  }

  // Delete admin (only SUPER can delete, and cannot delete themselves or last SUPER)
  async deleteAdmin(id: string, currentAdmin: Admin): Promise<void> {
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      throw new ForbiddenException('Only Super Admin can delete admins');
    }

    const targetAdmin = await this.adminRepo.findOne({
      _id: new Types.ObjectId(id),
    });
    if (!targetAdmin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot delete yourself
    if (currentAdmin._id.toString() === id) {
      throw new BadRequestException('You cannot delete yourself');
    }

    // Cannot delete the last SUPER admin
    if (targetAdmin.adminRole === AdminRole.SUPER) {
      const superAdminCount = await this.adminRepo.countAdminsByRole(
        AdminRole.SUPER,
      );
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last Super Admin');
      }
    }

    // Soft delete by deactivating
    await this.adminRepo.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { isActive: false },
    );
  }

  // Get admin profile
  async getProfile(admin: Admin): Promise<Admin> {
    return this.adminRepo.findOne({ _id: admin._id });
  }

  // Update admin activity
  async updateActivity(adminId: Types.ObjectId): Promise<void> {
    await this.adminRepo.findOneAndUpdate(
      { _id: adminId },
      { lastActivity: new Date() },
    );
  }

  // Generate token for admin
  async generateToken(admin: Admin): Promise<string> {
    const payload = {
      sub: admin._id,
      email: admin.email,
    };
    return this.jwtService.sign(payload);
  }

  // Validate admin token payload
  async validateAdminPayload(payload: any): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ _id: payload.sub });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin not found or inactive');
    }

    // Update last activity
    await this.updateActivity(admin._id);

    return admin;
  }

  async deactivateAdmin(id: string): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ _id: new Types.ObjectId(id) });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.adminRole === AdminRole.SUPER) {
      throw new BadRequestException('Cannot deactivate Super Admin');
    }

    return await this.adminRepo.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { isActive: false },
    );
  }

  private;
}

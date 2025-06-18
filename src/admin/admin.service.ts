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
import { CreateAdminDto, UpdateAdminDto, AdminLoginDto } from './dto';
import { Admin } from './models/admin.schema';
import { AdminRole } from '../common/shared';
import { TimeService } from '../common/config/time.service';
import { Types } from 'mongoose';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepo,
    private readonly jwtService: JwtService,
    private readonly timeService: TimeService,
  ) {}

  // Create new admin (only SUPER admin can create other admins)
  async createAdmin(
    createAdminDto: CreateAdminDto,
    currentAdmin: Admin,
  ): Promise<Admin> {
    // Only SUPER admin can create other admins
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      throw new ForbiddenException('Only Super Admin can create new admins');
    }

    // Check if admin already exists
    const existingAdmin = await this.adminRepo.findByEmail(createAdminDto.email);
    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    // Create admin
    const admin = await this.adminRepo.create({
      ...createAdminDto,
      password: hashedPassword,
      createdBy: currentAdmin._id,
      lastActivity: this.timeService.now(),
    });

    return admin;
  }

// // Admin login - whyy here ? because it is a common functionality with other mdel
//   async login(adminLoginDto: AdminLoginDto): Promise<{ admin: Admin; access_token: string }> {
//     const { email, password } = adminLoginDto;

//     // Find admin by email
//     const admin = await this.adminRepo.findByEmail(email);
//     if (!admin) {
//       throw new UnauthorizedException('Invalid credentials');
//     }

//     // Check if admin is active -- super can deactivate accounts
//     if (!admin.isActive) {
//       throw new UnauthorizedException('Admin account is deactivated');
//     }

//     // Verify password
//     const isPasswordValid = await bcrypt.compare(password, admin.password);
//     if (!isPasswordValid) {
//       throw new UnauthorizedException('Invalid credentials');
//     }

//     // Update last login
//     await this.adminRepo.findOneAndUpdate(
//       { _id: admin._id },
//       { 
//         lastLoginAt: this.timeService.now(),
//         lastActivity: this.timeService.now(),
//       },
//     );

//     // Generate JWT token
//     const payload = {
//       sub: admin._id, 
//       email: admin.email,
//     };
//     const access_token = this.jwtService.sign(payload);

//     return { admin, access_token };
//   }

  // Get all admins (SUPER and MANAGER can view all)
  async getAllAdmins(currentAdmin: Admin): Promise<Admin[]> {
    // no need for pagination there wont be many admins
    return this.adminRepo.findActiveAdmins();
  }

  
  // Get admin by ID
  async getAdminById(id: string, currentAdmin: Admin): Promise<Admin> {

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
    const targetAdmin = await this.adminRepo.findOne({ _id: new Types.ObjectId(id) });
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
      if (updateAdminDto.role || updateAdminDto.hasOwnProperty('isActive')) {
        throw new ForbiddenException('You cannot change role or activation status');
      }
    }

    // Prevent deactivating the last SUPER admin
    if (
      updateAdminDto.isActive === false &&
      targetAdmin.adminRole === AdminRole.SUPER
    ) {
      const superAdminCount = await this.adminRepo.countAdminsByRole(AdminRole.SUPER);
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot deactivate the last Super Admin');
      }
    }

    // Hash password if provided
    if (updateAdminDto.password) {
      updateAdminDto.password = await bcrypt.hash(updateAdminDto.password, 10);
    }

    const updatedAdmin = await this.adminRepo.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { ...updateAdminDto, lastActivity: this.timeService.now() },
    );

    return updatedAdmin;
  }

  // Delete admin (only SUPER can delete, and cannot delete themselves or last SUPER)
  async deleteAdmin(id: string, currentAdmin: Admin): Promise<void> {
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      throw new ForbiddenException('Only Super Admin can delete admins');
    }

    const targetAdmin = await this.adminRepo.findOne({ _id: new Types.ObjectId(id) });
    if (!targetAdmin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot delete yourself
    if (currentAdmin._id.toString() === id) {
      throw new BadRequestException('You cannot delete yourself');
    }

    // Cannot delete the last SUPER admin
    if (targetAdmin.adminRole === AdminRole.SUPER) {
      const superAdminCount = await this.adminRepo.countAdminsByRole(AdminRole.SUPER);
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
      { lastActivity: this.timeService.now() },
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
    const admin = await this.adminRepo.findOne({ _id:payload.sub});
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin not found or inactive');
    }

    // Update last activity
    await this.updateActivity(admin._id);
    
    return admin;
  }
}

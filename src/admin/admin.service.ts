import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminRepo } from './repo/admin.repo';
import { CreateAdminDto, UpdateAdminDto, AdminSearchDto } from './dto';
import { Admin } from './models/admin.schema';
import { AdminRole } from '../common/shared';
import { Types } from 'mongoose';
import { IpService } from 'src/common/services/ip.service';
import { cleanResponseArray } from '../common/utils/response.utils';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepo,
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
      const country = await this.ipService.getCountryFromIp(ipAddress);
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
    return this.adminRepo.findAllAdmins();
  }

  // Search admins with pagination and filtering
  async searchAdmins(searchDto: AdminSearchDto) {
    const { query, isActive, page = 1, limit = 10, adminRole } = searchDto;

    // Build search filter
    const searchFilter: any = {};

    // Add isActive filter if provided
    if (typeof isActive === 'boolean') {
      searchFilter.isActive = isActive;
    }

    // Add adminRole filter if provided
    if (adminRole) {
      searchFilter.adminRole = adminRole;
    }

    // Add text search filter if query is provided
    if (query && query.trim() !== '') {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchFilter.$or = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        // Full name search - concatenate firstName and lastName
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$firstName', ' ', '$lastName'] },
              regex: query.trim(),
              options: 'i',
            },
          },
        },
      ];
    }

    // Use repository pagination method
    const result = await this.adminRepo.findWithPagination(
      searchFilter,
      page,
      limit,
    );

    return {
      admins: cleanResponseArray(result.data),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
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
  async deleteAdmin(id: string, currentAdmin: Admin): Promise<Admin> {
    if (currentAdmin.adminRole !== AdminRole.SUPER) {
      throw new ForbiddenException('Only Super Admin can delete admins');
    }

    const targetAdmin = await this.adminRepo.findOne({
      _id: id,
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
    const deletedAdmin = await this.adminRepo.findOneAndDelete({
      _id: new Types.ObjectId(id),
    });
    return deletedAdmin;
  }

  // Update admin activity
  async updateActivity(adminId: Types.ObjectId): Promise<void> {
    await this.adminRepo.findOneAndUpdate(
      { _id: adminId },
      { lastActivity: new Date() },
    );
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
}

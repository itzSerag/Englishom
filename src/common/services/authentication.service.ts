import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepo } from '../../user/repo/user.repo';
import { AdminRepo } from '../../admin/repo/admin.repo';
import { User } from '../../user/models/user.schema';
import { Admin } from '../../admin/models/admin.schema';
import { TimeService } from '../config/time.service';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly adminRepo: AdminRepo,
    private readonly timeService: TimeService,
  ) {}

  /**
   * Find user by email in both User and Admin collections
   * Returns the found entity with type information
   */
  async findUserByEmail(email: string): Promise<(User | Admin) & { userType: 'user' | 'admin' } | null> {
    // First try to find in User collection
    const user = await this.userRepo.findOne({ email });
    if (user) {
      return Object.assign(user, { userType: 'user' as const });
    }

    // Then try to find in Admin collection
    const admin = await this.adminRepo.findByEmail(email);
    if (admin && admin.isActive) {
      return Object.assign(admin, { userType: 'admin' as const });
    }

    return null;
  }

  /**
   * Find user by ID in both User and Admin collections
   * Used by JWT strategy for token validation
   */
  async findUserById(id: string): Promise<(User | Admin) & { userType: 'user' | 'admin' } | null> {
    // First try to find in User collection
    const user = await this.userRepo.findOne({ _id: id });
    if (user) {
      return Object.assign(user, { userType: 'user' as const });
    }

    // Then try to find in Admin collection
    const admin = await this.adminRepo.findOne({ _id: id });
    if (admin && admin.isActive) {
      return Object.assign(admin, { userType: 'admin' as const });
    }

    return null;
  }

  /**
   * Update last activity for user or admin
   */
  async updateLastActivity(id: string, userType: 'user' | 'admin'): Promise<void> {
    const now = this.timeService.now();
    
    if (userType === 'user') {
      await this.userRepo.findOneAndUpdate(
        { _id: id },
        { lastActivity: now },
      );
    } else {
      await this.adminRepo.findOneAndUpdate(
        { _id: id },
        { lastActivity: now },
      );
    }
  }

  /**
   * Validate and get fresh user data with current role
   * This ensures role changes are immediately reflected
   */
  async validateAndGetUser(payload: { sub: string; email: string }): Promise<User | Admin> {
    const userWithType = await this.findUserById(payload.sub);
    
    if (!userWithType) {
      throw new UnauthorizedException('User not found');
    }

    // For admins, check if account is still active
    if (userWithType.userType === 'admin' && !(userWithType as Admin).isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    // Update activity if stale
    if (this.timeService.isActivityStale(userWithType.lastActivity)) {
      await this.updateLastActivity(payload.sub, userWithType.userType);
    }

    // Return the user/admin object (without the userType property)
    const { userType, ...cleanUser } = userWithType;
    return cleanUser as User | Admin;
  }
}

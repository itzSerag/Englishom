import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepo } from '../../user/repo/user.repo';
import { AdminRepo } from '../../admin/repo/admin.repo';
import { User } from '../../user/models/user.schema';
import { Admin } from '../../admin/models/admin.schema';
import { UserStatus } from '../shared';

@Injectable()
export class GlobalAuthenticationService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly adminRepo: AdminRepo,
  ) {}

  /**
   * Find user by email in both User and Admin collections
   */
  async findUserByEmail(email: string): Promise<User | Admin> {
    // First try to find in User collection
    const user = await this.userRepo.findOne({ email });
    if (user) {
      return user;
    }

    // Then try to find in Admin collection
    const admin = await this.adminRepo.findByEmail(email);
    if (admin?.isActive) {
      return admin;
    }

    return null;
  }

  /**
   * Find user by ID in both User and Admin collections
   * Used by JWT strategy for token validation
   */
  async findUserById(id: string): Promise<User | Admin | null> {
    // First try to find in User collection
    const user = await this.userRepo.findOne({ _id: id });
    if (user) {
      return user;
    }

    // Then try to find in Admin collection
    const admin = await this.adminRepo.findOne({ _id: id });
    if (admin?.isActive) {
      return admin;
    }

    return null;
  }

  /**
   * Update last activity for user or admin
   */
  async updateLastActivity(user: User | Admin): Promise<void> {
    const now = Date.now();

    if (user instanceof User) {
      await this.userRepo.findOneAndUpdate(
        { _id: user._id },
        { lastActivity: now },
      );
    } else {
      await this.adminRepo.findOneAndUpdate(
        { _id: user._id },
        { lastActivity: now },
      );
    }
  }

  /**
   * Centralized activity tracking
   * Use this method for consistent activity updates across the app
   */
  async trackUserActivity(user: User | Admin): Promise<void> {
    const now = Date.now();
    const updateData: any = { lastActivity: now };

    if (user instanceof User) {
      await this.userRepo.findOneAndUpdate({ _id: user._id }, updateData);
    } else {
      await this.adminRepo.findOneAndUpdate({ _id: user._id }, updateData);
    }
  }

  /**
   * Validate and get fresh user data with current role
   * This ensures role changes are immediately reflected
   */
  async validateAndGetUser(payload: {
    sub: string;
    email: string;
  }): Promise<User | Admin> {
    const user = await this.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // For regular users, check account status
    if (user instanceof User) {
      const userEntity = user;
      if (userEntity.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException({
          message:
            'Your account has been suspended. Please contact support to reactivate your account.',
          statusCode: 401,
          error: 'Account Suspended',
          suspendedAt: userEntity.suspendedAt,
          reason: userEntity.suspensionReason,
        });
      }

      if (userEntity.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException({
          message:
            'Your account has been permanently blocked. Please contact support.',
          statusCode: 401,
          error: 'Account Blocked',
        });
      }
    }

    // For admins, check if account is still active
    if (user instanceof Admin && !user.isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    // Update activity if stale
    if (this.isActivityStale(user.lastActivity)) {
      await this.updateLastActivity(user);
    }

    return user;
  }

  private isActivityStale(lastActivityTime: Date, staleMinutes = 1): boolean {
    const currentTime = Date.now();
    const staleThreshold = new Date(currentTime - staleMinutes * 60000);
    return lastActivityTime < staleThreshold;
  }
}

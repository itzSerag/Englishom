import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminRepo } from '../admin/repo/admin.repo';
import { IPayload } from '../common/shared/interfaces/payload.interface';
import { Admin } from '../admin/models/admin.schema';
import { log } from 'console';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminRepo: AdminRepo,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Admin login - Separate from user login
   */
  async login(email: string, password: string) {
    const admin = await this.adminRepo.findByEmail(email);

    log(admin, 'this is the admin');

    if (!admin) {
      throw new NotFoundException('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last activity
    await this.adminRepo.findOneAndUpdate(
      { _id: admin._id },
      { lastActivity: new Date() },
    );

    const access_token = this.generateToken(admin);

    return { access_token, admin };
  }

  /**
   * Generate JWT token for admin
   */
  generateToken(admin: Admin): string {
    const payload: IPayload = {
      sub: admin._id.toString(),
      email: admin.email,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate admin by ID for JWT strategy
   */
  async validateAdmin(adminId: string): Promise<Admin | null> {
    const admin = await this.adminRepo.findOne({ _id: adminId });

    if (!admin?.isActive) {
      return null;
    }

    return admin;
  }
}

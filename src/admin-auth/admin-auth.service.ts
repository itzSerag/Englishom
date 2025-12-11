import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminRepo } from '../admin/repo/admin.repo';
import { IAdminPayload } from '../common/shared/interfaces/payload.interface';
import { Admin } from '../admin/models/admin.schema';
import { AdminLoginDto } from './dto';
import { AuthMessages } from '../common/shared/const';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminRepo: AdminRepo,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Admin login - Separate from user login
   */
  async login(adminLoginDto : AdminLoginDto): Promise<{ access_token: string; admin: Admin }> {
    const admin = await this.adminRepo.findByEmail(adminLoginDto.email);

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);
    }

    const isValidPassword = await bcrypt.compare(adminLoginDto.password, admin.password);

    if (!isValidPassword) {
      throw new UnauthorizedException(AuthMessages.INVALID_CREDENTIALS);
    }

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
    const payload: IAdminPayload = {
      sub: admin._id.toString(),
      email: admin.email,
      role: 'admin',
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate admin by ID for JWT strategy
   */
  async validateAdmin(adminId: string): Promise<Admin | null> {
    const admin = await this.adminRepo.findOne({ _id: adminId });
    return admin;
  }
}

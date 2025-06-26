import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IPayload } from '../common/shared/interfaces/payload.interface';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/models/user.schema';
import { UserRepo } from '../user/repo/user.repo';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../common/mail/mail.service';
import { OtpRepo } from './repo/repo.otp';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { AuthenticationService } from 'src/common/services/authentication.service';
import { IpService } from 'src/common/services/ip.service';
import { Admin } from 'src/admin/models/admin.schema';
import { Role, UserStatus } from 'src/common/shared';
import { OtpCause } from './enum/otp-cause.enum';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import { IResetTokenPayload } from './interfaces/reset-token-payload.interface';
import { ResendOtpDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly otpRepo: OtpRepo,
    private readonly globalAuthService: AuthenticationService,
    private readonly ipService: IpService,
  ) {}

  async register(createUserDto: CreateUserDto, req?: any) {
    // Get IP address for country detection
    let ipAddress: string | undefined;
    if (req) {
      ipAddress = this.ipService.getRealIp(req);
    }

    const user = await this.userService.create(createUserDto, ipAddress);

    if (user) {
      // Generate and send OTP for email verification
      await this.generateAndSendOtp(user.email, OtpCause.EMAIL_VERIFICATION);
    } else {
      throw new ConflictException('User already exists with this email');
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.globalAuthService.findUserByEmail(loginDto.email);

    if (!user) {
      throw new NotFoundException('Invalid Credentials');
    }


    if (user instanceof User) {
        if (user.strategy !== 'local') {
          throw new ConflictException(
            'This email has signed-up with a different method ' + user.strategy,
          );
    }

      // Check user status for regular users
      const userEntity = user as User;
      if (userEntity.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException({
          message: 'Your account has been suspended. Please contact support to reactivate your account.',
          statusCode: 401,
          error: 'Account Suspended',
          suspendedAt: userEntity.suspendedAt,
          reason: userEntity.suspensionReason,
        });
      }

      if (userEntity.status === UserStatus.BLOCKED) {
        throw new UnauthorizedException({
          message: 'Your account has been permanently blocked. Please contact support.',
          statusCode: 401,
          error: 'Account Blocked',
        });
      }
    }

    const isValid =
      user && (await bcrypt.compare(loginDto.password, user.password));

    if (!isValid) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const access_token = await this.generateToken(user);

    // Update last activity
    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      {
        lastActivity: new Date(),
      },
    );

    return user;
  }

  async logout(user: User | Admin) {
    // FRONTEND LOGOUT
    return true;
  }

  async verifyOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const { email, otp, cause } = verifyOtpDto;

    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this is for email verification and user is already verified
    if (cause === OtpCause.EMAIL_VERIFICATION && user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    const otpRecord = await this.otpRepo.findOne({ email, cause });

    if (!otpRecord || otpRecord.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Handle different causes
    if (cause === OtpCause.EMAIL_VERIFICATION) {
      const [newUser, __] = await Promise.all([
        this.userRepo.findOneAndUpdate({ email }, { isVerified: true }),
        this.otpRepo.delete({ email, cause }),
      ]);


      return newUser;

    } else if (cause === OtpCause.FORGET_PASSWORD) {
      // For forget password, delete the OTP and generate reset token
      await this.otpRepo.delete({ email, cause });

      // Generate JWT reset token (15 minutes expiration)
      const resetTokenPayload: IResetTokenPayload = {
        email,
        type: 'password_reset',
      };

      const resetToken = this.jwtService.sign(resetTokenPayload, {
        expiresIn: '15m', // 15 minutes
      });

      return {
        resetToken,
        message: 'OTP verified successfully. You can now reset your password.',
      };
    }

    throw new BadRequestException('Invalid OTP cause');
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const user = await this.userRepo.findOne({ email: resendOtpDto.email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For email verification, check if user is not already verified
    if (resendOtpDto.cause === OtpCause.EMAIL_VERIFICATION && user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    // Generate and send OTP (old OTP deletion is handled automatically)
    await this.generateAndSendOtp(resendOtpDto.email, resendOtpDto.cause || OtpCause.EMAIL_VERIFICATION);

    const message =
      resendOtpDto.cause === OtpCause.EMAIL_VERIFICATION
        ? 'OTP has been sent to your email'
        : 'Password reset OTP has been sent to your email';

    return { message };
  }

  async forgetPassword(email: string) {
    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate and send new OTP for password reset
    // (old OTP deletion is handled automatically in generateAndSendOtp)
    await this.generateAndSendOtp(email, OtpCause.FORGET_PASSWORD);

    return { message: 'Password reset OTP has been sent to your email' };
  }

  // Old OTP-based password reset method removed
  // Use resetPasswordWithToken instead for JWT-based flow

  async generateToken(user: User | Admin) {
    const payload: IPayload = { sub: user._id.toString(), email: user.email };
    try {
      return this.jwtService.sign(payload);
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err);
    }
  }

  async findOrCreateOAuthUser(profile: any, req?: any) {
    const { email, strategy, firstName, lastName } = profile;
    // return user levels
    if (!email) {
      throw new BadRequestException('Email is required for OAuth login');
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Create new user with IP detection for country
      const password = Math.random().toString(36).slice(-8); // fallback password
      
      // Get country from IP if request is available
      let country = 'unknown';
      if (req) {
        const ip = this.ipService.getRealIp(req);
        country = await this.ipService.getCountryFromIp(ip);
      }

      const newUser = await this.userRepo.create({
        email,
        firstName,
        lastName,
        password,
        strategy,
        isVerified: true,
        lastActivity: new Date(),
        country,
      });

      return newUser;
    }

    if (user.strategy !== strategy) {
      throw new ConflictException(
        `Email already registered using ${user.strategy}. Please login using that method.`,
      );
    }

    // Update user profile if needed and update last activity
    const updateData: any = {
      lastActivity: new Date(),
    };

    if (user.firstName !== firstName || user.lastName !== lastName) {
      updateData.firstName = firstName;
      updateData.lastName = lastName;
    }

    await this.userRepo.findOneAndUpdate({ _id: user._id }, updateData);

    return user;
  }

  async getUserLevels(userId: string) {
    return await this.userService.getUserCompletedLevelNames(userId);
  }

  async resetPasswordWithToken(resetPasswordDto: ResetPasswordWithTokenDto) {
    const { resetToken, newPassword } = resetPasswordDto;

    try {
      // Verify and decode the reset token
      const payload = this.jwtService.verify<IResetTokenPayload>(resetToken);

      // Validate token type
      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid reset token type');
      }

      const { email } = payload;

      // Find the user
      const user = await this.userRepo.findOne({ email });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and last activity
      await this.userRepo.findOneAndUpdate(
        { email },
        {
          password: hashedPassword,
          lastActivity: new Date(),
        },
      );

      return { message: 'Password reset successful' };
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid reset token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException(
          'Reset token has expired. Please request a new password reset.',
        );
      }
      throw error; // Re-throw other errors (like NotFoundException, etc.)
    }
  }

  private async generateAndSendOtp(email: string, cause: OtpCause) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
    
      await this.otpRepo.delete({ email, cause });
      
      await this.otpRepo.create({ email, otp, cause });

      // Send email only after successful OTP creation
      await this.emailService.sendEmail(email, otp, cause);
    } catch (err) {
      // If OTP creation fails, don't send email
      throw new InternalServerErrorException(
        'Something happened while generating the OTP, Please try again, ' + err,
      );
    }

    return otp;
  }
}

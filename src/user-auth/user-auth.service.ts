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
import { MailService } from '../common/mail/mail.service';
import { OtpRepo } from './repo/repo.otp';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { IpService } from '../common/services/ip.service';
import { OtpCause } from './enum/otp-cause.enum';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import { IResetTokenPayload } from './interfaces/reset-token-payload.interface';
import { ResendOtpDto } from './dto';
import { UserStatus } from '../common/shared';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly otpRepo: OtpRepo,
    private readonly ipService: IpService,
  ) {}

  async signup(createUserDto: CreateUserDto, req?: any) {
    // Get IP address for country detection
    let ipAddress: string | undefined;
    if (req) {
      ipAddress = this.ipService.getRealIp(req);
    }
    if (ipAddress) {
      createUserDto.ipAddress = ipAddress;
      createUserDto.country = await this.ipService.getCountryFromIp(ipAddress);
    }

    const user = await this.userService.create(createUserDto);

    if (user) {
      // Generate and send OTP for email verification
      await this.generateAndSendOtp(user.email, OtpCause.EMAIL_VERIFICATION);
    } else {
      throw new ConflictException('User already exists with this email');
    }

    const access_token = this.generateToken(user);
    return { user, access_token };
  }

  /**
   * User login - Only for regular users, not admins
   */
  async login(loginDto: LoginDto) {
    const user = await this.userRepo.findOne({ email: loginDto.email });

    if (!user) {
      throw new NotFoundException('Invalid Credentials');
    }

    // Check if the user is using local strategy
    if (user.strategy !== 'local') {
      throw new ConflictException(
        'This email has signed-up with a different method ' + user.strategy,
      );
    }

    // Check account status
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException({
        message:
          'Your account has been suspended. Please contact support to reactivate your account.',
        statusCode: 401,
        error: 'Account Suspended',
        suspendedAt: user.suspendedAt,
        reason: user.suspensionReason,
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new UnauthorizedException({
        message:
          'Your account has been permanently blocked. Please contact support.',
        statusCode: 401,
        error: 'Account Blocked',
      });
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const access_token = this.generateToken(user);

    // Update last activity
    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      { lastActivity: new Date() },
    );

    return { access_token, user };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
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

      const resetTokenPayload: IResetTokenPayload = {
        email,
        type: 'password_reset',
      };

      const resetToken = this.jwtService.sign(resetTokenPayload, {
        expiresIn: '15m',
      });

      return {
        resetToken,
        message: 'OTP verified successfully. You can now reset your password.',
      };
    } else {
      throw new BadRequestException('Something went wrong in otp verification');
    }
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

    // Generate and send OTP
    await this.generateAndSendOtp(
      resendOtpDto.email,
      resendOtpDto.cause || OtpCause.EMAIL_VERIFICATION,
    );

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

    await this.generateAndSendOtp(email, OtpCause.FORGET_PASSWORD);

    return { message: 'Password reset OTP has been sent to your email' };
  }

  generateToken(user: User) {
    const payload: IPayload = { sub: user._id.toString(), email: user.email , role: 'user'};
    try {
      return this.jwtService.sign(payload);
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err);
    }
  }

  async findOrCreateOAuthUser(profile: any, req?: any) {
    const { email, strategy, firstName, lastName } = profile;

    if (!email) {
      throw new BadRequestException('Email is required for OAuth login');
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      const password = Math.random().toString(36).slice(-8);

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

  async getUserDetailsForLogin(userId: string) {
    return await this.userService.getUserDetails(userId);
  }

  async resetPasswordWithToken(resetPasswordDto: ResetPasswordWithTokenDto) {
    const { resetToken, newPassword } = resetPasswordDto;

    try {
      const payload = this.jwtService.verify<IResetTokenPayload>(resetToken);

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid reset token type');
      }

      const { email } = payload;

      const user = await this.userRepo.findOne({ email });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

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
      throw error;
    }
  }

  /**
   * Validate user by ID for JWT strategy
   */
  async validateUser(userId: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ _id: userId });

    if (!user) {
      return null;
    }

    // Check account status
    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.BLOCKED
    ) {
      return null;
    }

    return user;
  }

  private async generateAndSendOtp(email: string, cause: OtpCause) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await this.otpRepo.delete({ email, cause });
      await this.otpRepo.create({ email, otp, cause });
      await this.mailService.sendEmail(email, otp, cause);
    } catch (err) {
      throw new InternalServerErrorException(
        'Something happened while generating the OTP, Please try again, ' + err,
      );
    }

    return otp;
  }
}

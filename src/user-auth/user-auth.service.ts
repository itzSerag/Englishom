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
import { TimeService } from '../common/config/time.service';
import { AuthMessages } from '../common/shared/const';
import { TokenType } from './enum';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly otpRepo: OtpRepo,
    private readonly ipService: IpService,
    private readonly timeService: TimeService,
  ) {}

  async signup(createUserDto: CreateUserDto, req?: any) {
    // Get IP address for country detection
    let ipAddress: string | undefined;
    if (req) {
      ipAddress = this.ipService.getRealIp(req);
    }
    if (ipAddress) {
       createUserDto.ipAddress = ipAddress;
     }

    const user = await this.userService.create(createUserDto);

    if (user) {
      // Generate and send OTP for email verification
      await this.generateAndSendOtp(user.email, OtpCause.EMAIL_VERIFICATION);
    } else {
      throw new ConflictException('User already exists with this email');
    }

    // Generate session ID and token
    const jti =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Store the session ID in database
    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      { activeSessionId: jti },
    );

    const access_token = this.generateTokenWithJti(user, jti);
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
        'This email has signed-up with a different method '
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

    // Generate new session ID - this will invalidate all other sessions
    const jti =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Update last activity and store new session ID (invalidates previous sessions)
    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      {
        lastActivity: this.timeService.createDate(),
        activeSessionId: jti,
      },
    );

    const access_token = this.generateTokenWithJti(user, jti);

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

    if (otpRecord?.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Handle different causes
    if (cause === OtpCause.EMAIL_VERIFICATION) {
      // Keep the same session ID from signup - just mark user as verified
      const [newUser, __] = await Promise.all([
        this.userRepo.findOneAndUpdate(
          { email },
          {
            isVerified: true,
            // activeSessionId stays the same - no change
          },
        ),
        this.otpRepo.delete({ email, cause }),
      ]);

      // Return the existing session token (use existing activeSessionId)
      const access_token = this.generateTokenWithJti(
        newUser,
        newUser.activeSessionId,
      );
      return { user: newUser, access_token };
    } else if (cause === OtpCause.FORGET_PASSWORD) {
      // For forget password, delete the OTP and generate reset token
      await this.otpRepo.delete({ email, cause });

      const resetTokenPayload: IResetTokenPayload = {
        email,
        type: TokenType.PASSWORD_RESET,
      };

      const resetToken = this.jwtService.sign(resetTokenPayload, {
        expiresIn: '15m',
      });

      return {
        resetToken,
        message: AuthMessages.OTP_VERIFIED_SUCCESSFULLY,
      };
    } else {
      throw new BadRequestException('Something went wrong - otp verification');
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
        ? AuthMessages.OTP_SENT
        : AuthMessages.FORGET_PASSWORD;

    return { message };
  }



  async forgetPassword(email: string) {
    const user = await this.userRepo.findOne({ email });

    if (!user) { throw new NotFoundException(AuthMessages.USER_NOT_FOUND_OR_INACTIVE); }

    await this.generateAndSendOtp(email, OtpCause.FORGET_PASSWORD);

    return { message: AuthMessages.FORGET_PASSWORD };
  
  }

  generateToken(user: User) {
    // Generate a unique session ID for this login
    const jti =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    return this.generateTokenWithJti(user, jti);
  }

  generateTokenWithJti(user: User, jti: string) {
    const payload: IPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: 'user',
      jti,
    };

    try {
      return this.jwtService.sign(payload);
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err);
    }
  }

  /**
   * Create a new session for the user (single-device login) and
   * generate a JWT that embeds the same session ID (jti).
   * Used for OAuth logins so that the token is accepted by UserJwtStrategy.
   */
  async createSessionAndGenerateToken(user: User): Promise<string> {
    const jti =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      {
        lastActivity: this.timeService.createDate(),
        activeSessionId: jti,
      },
    );

    return this.generateTokenWithJti(user, jti);
  }

  async findOrCreateOAuthUser(profile: any, req?: any) {
    const { email, strategy, firstName, lastName } = profile;

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
        lastActivity: this.timeService.createDate(),
        country,
      });

      return newUser;
    }

    if (user.strategy !== strategy) {
      throw new ConflictException(
        AuthMessages.EMAIL_ANOTHER_METHOD
      );
    }

    const updateData: any = {
      lastActivity: this.timeService.createDate(),
    };

    if (user.firstName !== firstName || user.lastName !== lastName) {
      updateData.firstName = firstName;
      updateData.lastName = lastName;
    }

    const updatedUser = await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      updateData,
    );

    return updatedUser;
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

      if (payload.type !== TokenType.PASSWORD_RESET) {
        throw new BadRequestException(AuthMessages.INVALID_TOKEN_TYPE);
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
          lastActivity: this.timeService.createDate(),
        },
      );

      return { message: 'Password reset successful' };
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException(AuthMessages.RESET_TOKEN_UNACCEPTED);
      }
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException(
          AuthMessages.INVALID_SESSION,
        );
      }
      throw error;
    }
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

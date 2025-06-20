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
import { Admin } from 'src/admin/models/admin.schema';
import { Role } from 'src/common/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly otpRepo: OtpRepo,
    private readonly globalAuthService : AuthenticationService
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);

    if (user) {
      // Generate and send OTP
      await this.generateAndSendOtp(user.email);
    } else {
      throw new ConflictException('User already exists with this email');
    }

    return user;
  }


  
  async login(loginDto: LoginDto) {
    const user  = await this.globalAuthService.findUserByEmail(loginDto.email);

    if (!user) {
      throw new NotFoundException('Invalid Credentials');
    }

    if (user.role === Role.USER){

      if (user.strategy !== 'local') {
        throw new ConflictException(
          'This email has signed-up with a different method ' + user.strategy,
        );
      }
    }

    const isValid =
      user && (await bcrypt.compare(loginDto.password, user.password));
  
    if (!isValid) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const access_token = await this.generateToken(user);

    // Update last login time
    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      { 
        lastActivity: Date.now() ,
      },
    );

    return user;
  }


  async logout(user: User | Admin) {
    // FRONTEND LOGOUT
    return true;
  }



  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }

    const otpRecord = await this.otpRepo.findOne({ email });

    if (!otpRecord || otpRecord.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const [_, __] = await Promise.all([
      this.userRepo.findOneAndUpdate({ email }, { isVerified: true }),
      this.otpRepo.delete({ email }),
    ]);

    return user;
  }


  async resendOtp(email: string) {
    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('User already verified');
    }
    await this.otpRepo.delete({ email });
    await this.generateAndSendOtp(email);
    return { message: 'OTP has been sent to your email' };
  }

  async forgetPassword(email: string) {
    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete any existing OTP for this email
    await this.otpRepo.delete({ email });
    
    // Generate and send new OTP
    await this.generateAndSendOtp(email);
    
    return { message: 'Password reset OTP has been sent to your email' };
  }

  async resetPasswordWithOtp(resetPasswordWithOtpDto: any) {
    const { email, otp, newPassword } = resetPasswordWithOtpDto;

    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpRecord = await this.otpRepo.findOne({ email });

    if (!otpRecord || otpRecord.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and delete OTP
    const [updatedUser, _] = await Promise.all([
      this.userRepo.findOneAndUpdate(
        { email }, 
        { 
          password: hashedPassword,
          lastActivity: Date.now()
        }
      ),
      this.otpRepo.delete({ email })
    ]);

    return { message: 'Password reset successful' };
  }


  async generateToken(user: User | Admin) {

    const payload: IPayload = { sub: user._id.toString(), email: user.email };
    try {
      return this.jwtService.sign(payload);
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err);
    }
  }

  async findOrCreateOAuthUser(profile: any) {
    const { email, strategy, firstName, lastName } = profile;
    // return user levels
    if (!email) {
      throw new BadRequestException('Email is required for OAuth login');
    }

    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Create new user
      const password = Math.random().toString(36).slice(-8); // fallback password
      const newUser = await this.userRepo.create({
        email,
        firstName,
        lastName,
        password,
        strategy,
        isVerified: true,
        lastActivity:  new Date(),
      });

      return newUser;
    }

    if (user.strategy !== strategy) {
      throw new ConflictException(
        `Email already registered using ${user.strategy}. Please login using that method.`,
      );
    }

    // Update user profile if needed and update last login
    const updateData: any = {
      lastActivity: Date.now(),
    };

    if (user.firstName !== firstName || user.lastName !== lastName) {
      updateData.firstName = firstName;
      updateData.lastName = lastName;
    }

    await this.userRepo.findOneAndUpdate(
      { _id: user._id },
      updateData
    );

    return user;
  }


  async getUserLevels(userId: string) {
    return await this.userService.getUserCompletedOrders(userId);
  }

  private async generateAndSendOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await this.otpRepo.create({ email, otp });

      await this.emailService.sendEmail(email, otp);
    } catch (err) {
      throw new InternalServerErrorException(
        'Something happened while sending the otp, Please try again, ' + err,
      );
    }

    return otp;
  }
}

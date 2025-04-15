import { Injectable, InternalServerErrorException, UnauthorizedException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IPayload } from '../common/shared/interfaces/payload.interface';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/models/user.schema';
import { UserRepo } from '../user/repo/repo.user';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'
import { EmailService } from '../common/mail/mail.service';
import { OtpRepo } from './repo/repo.otp';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto';

@Injectable()
export class AuthService {

  constructor(
    private readonly userRepo: UserRepo,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly otpRepo: OtpRepo
  ) { }


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
    const user = await this.userRepo.findOne({ email: loginDto.email });

    if (!user) {
      throw new NotFoundException('Invalid email or password');
    }
    if (user.strategy !== 'local') {
      throw new ConflictException('This email has signed-up with a different method ' + user.strategy);
    }
    const isValid = user && await bcrypt.compare(loginDto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  async logout(user: User) {
    // FRONTEND LOGOUT
    return true
  }

  async resetPassword(user: User, restPasswordDto: ResetPasswordDto) {

    // hash the new password

    //compare the old password and new password
    const isValid = await bcrypt.compare(restPasswordDto.oldPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(restPasswordDto.newPassword, 10);
    return await this.userRepo.findOneAndUpdate({ _id: user._id }, { password: hashedPassword });

  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepo.findOne({ email });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpRecord = await this.otpRepo.findOne({ email });

    if (!otpRecord || otpRecord.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const [_, __] = await Promise.all([
      this.userRepo.findOneAndUpdate({ email }, { isVerified: true }),
      this.otpRepo.delete({ email })
    ]);


    return user;
  }


  async resendOtp(email: string) {
    const user = await this.userRepo.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new ConflictException('User already verified');
    }
    await this.otpRepo.delete({ email });

    await this.generateAndSendOtp(email);

    return { message: 'OTP has been sent to your email' };
  }


  async generateToken(user: User) {
    const payload: IPayload = { sub: user._id.toString(), email: user.email };

    try {
      return this.jwtService.sign(payload);
    } catch (err) {
      throw new InternalServerErrorException('Something Went Wrong, ' + err);
    }
  }

  async findOrCreateOAuthUser(profile: any) {
    const { email, provider, firstName, lastName } = profile;

    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Create new user
      const password = Math.random().toString(36).slice(-8); // fallback password
      const newUser = await this.userRepo.create({
        email,
        firstName,
        lastName,
        password,
        strategy: provider,
        isVerified: true,
      });

      return newUser

    }

    if (user.strategy !== provider) {
      throw new ConflictException(
        `Email already registered using another method. Please login using that method.`,
      );
    }

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
      throw new InternalServerErrorException("Something happened while sending the otp, Please try again, " + err)
    }

    return otp;
  }
}

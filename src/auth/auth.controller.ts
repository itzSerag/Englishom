import {
  Controller,
  Post,
  Body,
  ConflictException,
  Get,
  UseGuards,
  HttpStatus,
  Res,
  Logger,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorator/public.decorator';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { Response } from 'express';
import { ForgetPasswordDto, ResetPasswordWithOtpDto } from './dto';
import { cleanSensitiveFields } from '../common/utils/response.utils';
import { Admin } from 'src/admin/models/admin.schema';
import { Role } from 'src/common/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService ) {}
  private logger = new Logger(AuthController.name);

  @Public()
  @Post('signup')
  async register(@Body() createAuthDto: CreateUserDto) {
    const user = await this.authService.register(createAuthDto);
    if (!user) {
      throw new ConflictException('User already exist');
    }

    const access_token = await this.authService.generateToken(user);

    return {
      access_token,
      user: cleanSensitiveFields(user),
      levels: [],
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user : User | Admin= await this.authService.login(loginDto);
    const access_token = await this.authService.generateToken(user);

    if (user.role === Role.ADMIN) {
      // If the user is an admin, we can return the admin-specific fields
      return {
        access_token,
        user: cleanSensitiveFields(user),
        levels: [],
      };
    }

    const levels = await this.authService.getUserLevels(user._id.toString());

    return {
      access_token,
      user: cleanSensitiveFields(user),
      levels: levels,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const user = await this.authService.verifyOtp(verifyOtpDto);

    // Update user verification status
    user.isVerified = true;
    const access_token = await this.authService.generateToken(user);

    return {
      access_token,
      user: cleanSensitiveFields(user),
    };
  }

  @Public()
  @Post('resend-otp')
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return await this.authService.resendOtp(resendOtpDto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forget-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    return await this.authService.forgetPassword(forgetPasswordDto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password-otp')
  async resetPasswordWithOtp(@Body() resetPasswordWithOtpDto: ResetPasswordWithOtpDto) {
    return await this.authService.resetPasswordWithOtp(resetPasswordWithOtpDto);
  }

  // OAUTH
  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin(): Promise<any> {
    return HttpStatus.OK;
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookLoginCallback(
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Facebook');
      }

      const newUser : User = await this.authService.findOrCreateOAuthUser(user);
      const jwt = await this.authService.generateToken(newUser);
      res.redirect(`${process.env.WEBSITE_URL}/en/callback?token=${jwt}`);
    } catch (err) {
      this.logger.error(
        `Facebook OAuth login failed: ${err.message}`,
        err.stack,
      );
      return res.redirect(
        `${process.env.WEBSITE_URL}/en/callback?error=auth_failed&message=${encodeURIComponent(err.message)}`,
      );
    }
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    return HttpStatus.OK;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @CurrentUser() user: any,
    @Res() res: Response,
  ): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Google');
      }

      const newUser : User = await this.authService.findOrCreateOAuthUser(user);
      const jwt = await this.authService.generateToken(newUser);
      res.redirect(`${process.env.WEBSITE_URL}/en/callback?token=${jwt}`);
    } catch (err) {
      this.logger.error(`Google OAuth login failed: ${err.message}`, err.stack);
      return res.redirect(
        `${process.env.WEBSITE_URL}/en/callback?error=auth_failed&message=${encodeURIComponent(err.message)}`,
      );
    }
  }

 

  @Post('logout')
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user);
    return {
      message: 'Logout successful',
    };
  }
}

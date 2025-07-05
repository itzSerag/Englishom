import {
  Controller,
  Post,
  Body,
  ConflictException,
  Get,
  UseGuards,
  HttpStatus,
  Res,
  Req,
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
import { Request, Response } from 'express';
import { ForgetPasswordDto, ResetPasswordWithTokenDto } from './dto';
import { Admin } from 'src/admin/models/admin.schema';
import { OtpCause } from './enum/otp-cause.enum';
import { cleanResponse } from '../common/utils/response.utils';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  private logger = new Logger(AuthController.name);

  @Public()
  @Post('signup')
  async register(@Body() createAuthDto: CreateUserDto, @Req() req: Request) {
    const { user, access_token } = await this.authService.register(
      createAuthDto,
      req,
    );

    return {
      access_token,
      user: cleanResponse(user),
      levels: [],
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { user, access_token } = await this.authService.login(loginDto);
    if (user instanceof Admin) {
      // If the user is an admin, we can return the admin-specific fields
      return {
        access_token,
        user: cleanResponse(user),
        levels: [],
      };
    }

    const levels = await this.authService.getUserLevels(user._id.toString());

    return {
      access_token,
      user: cleanResponse(user),
      levels: levels,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    // if there is no cause in verifyOtpDto, default to EMAIL_VERIFICATION
    if (!verifyOtpDto.cause) {
      verifyOtpDto.cause = OtpCause.EMAIL_VERIFICATION;
    }

    const result = await this.authService.verifyOtp(verifyOtpDto);

    // Handle different causes
    if (verifyOtpDto.cause === OtpCause.EMAIL_VERIFICATION) {
      // For email verification, return access token and user data
      const user = result as User;
      const access_token = await this.authService.generateToken(user);

      return {
        access_token,
        user: cleanResponse(user),
      };
    } else if (verifyOtpDto.cause === OtpCause.FORGET_PASSWORD) {
      // For forget password, just return success message
      return result;
    }
  }

  @Public()
  @Post('resend-otp')
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    if (!resendOtpDto.cause) {
      resendOtpDto.cause = OtpCause.EMAIL_VERIFICATION;
    }

    return await this.authService.resendOtp(resendOtpDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forget-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    return await this.authService.forgetPassword(forgetPasswordDto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password-token')
  async resetPasswordWithToken(
    @Body() resetPasswordDto: ResetPasswordWithTokenDto,
  ) {
    return await this.authService.resetPasswordWithToken(resetPasswordDto);
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
    @Req() req: Request,
  ): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Facebook');
      }

      const newUser: User = await this.authService.findOrCreateOAuthUser(
        user,
        req,
      );
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
    @Req() req: Request,
  ): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Google');
      }

      const newUser: User = await this.authService.findOrCreateOAuthUser(
        user,
        req,
      );
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

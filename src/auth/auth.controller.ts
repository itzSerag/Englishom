import { Controller, Post, Body, ConflictException, Get, UseGuards, HttpStatus, Res, Logger, UnauthorizedException, ClassSerializerInterceptor, UseInterceptors, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserDto } from '../common/shared/dto/user-dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorator/public.decorator';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { Response } from 'express';
import { plainToClass } from 'class-transformer';
import { ResetPasswordDto } from './dto';
import { SkipVerifiedGuard } from './guards/skip-verified.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  private logger = new Logger(AuthController.name);

  @Public()
  @UseInterceptors(ClassSerializerInterceptor)
  @Post('signup')


  async register(@Body() createAuthDto: CreateUserDto) {
    const user = await this.authService.register(createAuthDto);
    if (!user) {
      throw new ConflictException('User already exist')
    }

    const access_token = await this.authService.generateToken(user);

    return {
      access_token,
      user: plainToClass(UserDto, user, { excludeExtraneousValues: true }),
      levels: []
    }
  }

  @Public()
  @UseInterceptors(ClassSerializerInterceptor)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {

    const user = await this.authService.login(loginDto)
    const access_token = await this.authService.generateToken(user);
    const levels = await this.authService.getUserLevels(user._id.toString());

    return {
      access_token,
      user: new UserDto(user),
      levels: levels
    }
  }

  @Public()
  @UseInterceptors(ClassSerializerInterceptor)
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const user = await this.authService.verifyOtp(verifyOtpDto);

    const access_token = await this.authService.generateToken({
      ...user,
      isVerified: true // manually patch to avoid refetch
    });

    return {
      access_token,
      user: new UserDto({ ...user, isVerified: true })
    };
  }

  @Public()
  @Post('resend-otp')
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return await this.authService.resendOtp(resendOtpDto.email);
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
  async facebookLoginCallback(@CurrentUser() user: any, @Res() res: Response): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Facebook');
      }

      const newUser = await this.authService.findOrCreateOAuthUser(user);
      const jwt = await this.authService.generateToken(newUser);
      res.redirect(`${process.env.WEBSITE_URL}/en/callback?token=${jwt}`);
    } catch (err) {
      this.logger.error(`Facebook OAuth login failed: ${err.message}`, err.stack);
      return res.redirect(`${process.env.WEBSITE_URL}/en/callback?error=auth_failed&message=${encodeURIComponent(err.message)}`);
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
  async googleAuthRedirect(@CurrentUser() user: any, @Res() res: Response): Promise<any> {
    try {
      if (!user) {
        throw new UnauthorizedException('No user data received from Google');
      }

      const newUser = await this.authService.findOrCreateOAuthUser(user);
      const jwt = await this.authService.generateToken(newUser);
      res.redirect(`${process.env.WEBSITE_URL}/en/callback?token=${jwt}`);
    } catch (err) {
      this.logger.error(`Google OAuth login failed: ${err.message}`, err.stack);
      return res.redirect(`${process.env.WEBSITE_URL}/en/callback?error=auth_failed&message=${encodeURIComponent(err.message)}`);
    }
  }

  @Post('reset-password')
  async resetPassword(@CurrentUser() user: User, resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(user, resetPasswordDto);

    return {
      message: 'Password reset successful',
    };
  }

  @Post('logout')
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user);
    return {
      message: 'Logout successful',
    };
  }
}

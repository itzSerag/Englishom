import { Controller, Post, Body, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserDto } from 'src/common/shared/dto/user-dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  async register(@Body() createAuthDto: CreateUserDto) {
    const user = await this.authService.register(createAuthDto);
    if (!user) {
      throw new ConflictException('User already exist')
    }

    const access_token = await this.authService.generateToken(user);

    return {
      access_token,
      user: new UserDto(user)
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto)
  }


}

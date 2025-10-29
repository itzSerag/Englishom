import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from './decorators/public.decorator';
import { cleanResponse } from '../common/utils/response.utils';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() adminLoginDto: AdminLoginDto) {
    const { admin, access_token } = await this.adminAuthService.login(
     adminLoginDto
    );

    return {
      access_token,
      user: cleanResponse(admin),
    };
  }
}

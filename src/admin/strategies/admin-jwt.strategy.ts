import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { cleanResponse } from '../../common/utils/response.utils';
import { AdminAuthService } from '../../admin-auth/admin-auth.service';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const admin = await this.adminAuthService.validateAdmin(payload.sub);

      if (!admin) {
        throw new UnauthorizedException('Admin not found or inactive');
      }

      return cleanResponse(admin);
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}

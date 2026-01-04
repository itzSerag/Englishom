import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from '../admin-auth.service';
import { cleanResponse } from '../../common/utils/response.utils';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_ADMIN_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const admin = await this.adminAuthService.validateAdmin(payload.sub);

      // If admin does not exist OR is not active, reject the request
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException(
          'Admin not found or Admin is deactivated',
        );
      }

      // Return cleaned admin object (password will be removed by cleanResponse)
      return cleanResponse(admin);
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}

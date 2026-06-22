import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { GlobalAuthenticationService } from '../../common/services/authentication.service';
import { cleanResponse } from '../../common/utils/response.utils';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly globalAuthService: GlobalAuthenticationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_ADMIN_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const admin = await this.globalAuthService.validateAndGetUser(payload);
      return cleanResponse(admin);
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}

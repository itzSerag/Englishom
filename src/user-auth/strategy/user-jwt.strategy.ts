import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { UserAuthService } from '../user-auth.service';
import { cleanResponse } from '../../common/utils/response.utils';

@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'user-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userAuthService: UserAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const user = await this.userAuthService.validateUser(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return cleanResponse(user);
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}

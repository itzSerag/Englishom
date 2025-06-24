import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from '../../common/services/authentication.service';
import { cleanResponse } from '../../common/utils/response.utils';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authenticationService: AuthenticationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const user = await this.authenticationService.validateAndGetUser(payload);

      // Return cleaned user object (password will be removed by cleanSensitiveFields)
      return cleanResponse(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid token, ' + error.message);
    }
  }
}

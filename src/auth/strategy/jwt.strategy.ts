import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepo } from '../../user/repo/repo.user';
import { UserDto } from '../../common/shared/dto/user-dto';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const user = await this.userRepo.findOne({ _id: payload.sub });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return new UserDto(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid token, ' + error.message);
    }
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepo } from '../../user/repo/user.repo';
import { UserDto } from '../../common/shared/dto/user-dto';
import { IPayload } from '../../common/shared/interfaces/payload.interface';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/models/user.schema';
import { TimeService } from 'src/common/config/time.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly configService: ConfigService,
    private readonly timeService: TimeService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: IPayload) {
    try {
      const user: User = await this.userRepo.findOne({ _id: payload.sub });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (this.timeService.isActivityStale(user.lastActivity)) {
        await this.userRepo.findOneAndUpdate(
          { _id: user._id },
          { lastActivity: this.timeService.now() },
        );
      }

      return new UserDto(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid token, ' + error.message);
    }
  }
}

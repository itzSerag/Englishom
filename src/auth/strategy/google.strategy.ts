import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TimeService } from 'src/common/config/time.service';
import { User } from 'src/user/models/user.schema';
import { UserRepo } from 'src/user/repo/user.repo';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor
  (
    private readonly configService:ConfigService,
    private readonly timeService: TimeService,
    private readonly userRepo: UserRepo, 
    

  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, name } = profile;
    const user : Partial<User> = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      strategy: profile.provider,
    };

     if (this.timeService.isActivityStale(user.lastActivity)) {
        await this.userRepo.findOneAndUpdate(
          { _id: user._id },
          { lastActivity: this.timeService.now() },
        );
      }
    done(null, user);
  }
}

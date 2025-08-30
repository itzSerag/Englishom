import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/models/user.schema';
import { UserRepo } from 'src/user/repo/user.repo';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepo,
  ) {
    super({
      clientID: configService.get('FACEBOOK_APP_ID'),
      clientSecret: configService.get('FACEBOOK_APP_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/api/auth/facebook/callback`,
      scope: ['email'],
      profileFields: ['id', 'emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { emails, name } = profile;
    const user: Partial<User> = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      strategy: profile.provider,
    };

    // Activity tracking is handled by JWT strategy during token validation
    // No need to update lastActivity here
    done(null, user);
  }
}

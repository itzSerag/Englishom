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
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    try {
      const { emails, name } = profile;

      const user: Partial<User> = {
        email: emails[0].value,
        firstName: name?.givenName || '',
        lastName: name?.familyName || '',
        strategy: profile.provider,
      };

      // Pass the user data to the callback handler
      // User will be found or created there
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}

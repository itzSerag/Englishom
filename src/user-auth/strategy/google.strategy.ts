import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/models/user.schema';
import { UserRepo } from 'src/user/repo/user.repo';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepo,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
    console.log(
      'Google Strategy initialized with callback URL:',
      `${configService.get('BASE_URL')}/api/auth/google/callback`,
    );
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { emails, name } = profile;

      // Validate required fields
      if (!emails?.[0]?.value) {
        return done(new Error('Email is required from Google'), null);
      }

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

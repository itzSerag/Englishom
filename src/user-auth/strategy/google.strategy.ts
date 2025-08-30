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
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { emails, name } = profile;
    const user: Partial<User> = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      strategy: profile.provider,
    };

    // Find the database user for OAuth validation
    const dbUser = await this.userRepo.findOne({ email: user.email });
    if (!dbUser) {
      throw new Error('User not found');
    }

    // Activity tracking is handled by JWT strategy during token validation
    // No need to update lastActivity here
    done(null, dbUser);
  }
}

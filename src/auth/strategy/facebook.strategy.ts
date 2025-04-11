import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${process.env.BASE_URL}/auth/facebook/callback`,
      scope: ['email'], // Ensure 'email' is a valid scope
      profileFields: ['id', 'emails', 'name'], 
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { id, emails, name } = profile;
    const user = {
      facebookId: id,
      email: emails ? emails[0].value : null,
      firstName: name.givenName,
      lastName: name.familyName,
      provider: profile.provider,
    };

    done(null, user);
  }
}

import { Module, forwardRef } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { UserAuthController } from './user-auth.controller';
import { ConfigModule } from '../common/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../common/mail/mail.module';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { UserJwtStrategy } from './strategy/user-jwt.strategy';
import { OtpRepo } from './repo/repo.otp';
import { DatabaseModule } from '../common/database/database.module';
import { Otp, OtpSchema } from './models/otp.schema';
import { GoogleStrategy } from './strategy/google.strategy';
import { FacebookStrategy } from './strategy/facebook.strategy';
import { UserJwtGuard } from './guards/user-jwt.guard';
import { VerifiedGuard } from './guards/verified-user.guard';
import { UserStatusGuard } from './guards/user-status.guard';

@Module({
  imports: [
    PassportModule,
    MailModule,
    ConfigModule,
    DatabaseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    forwardRef(() => UserModule), // Use forwardRef here
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRATION_TIME') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserAuthController],
  providers: [
    UserAuthService,
    UserJwtStrategy,
    UserJwtGuard,
    VerifiedGuard,
    UserStatusGuard,
    GoogleStrategy,
    FacebookStrategy,
    OtpRepo,
  ],
  exports: [
    UserAuthService,
    OtpRepo,
    UserJwtGuard,
    VerifiedGuard,
    UserStatusGuard,
  ],
})
export class UserAuthModule {}

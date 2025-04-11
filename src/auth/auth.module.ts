// filepath: /mnt/DATA/Englishom/src/auth/auth.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule } from '../common/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../common/mail/mail.module';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './strategy/jwt.strategy';
import { OtpRepo } from './repo/repo.otp';
import { DatabaseModule } from '../common/database/database.module';
import { Otp, OtpSchema } from './models/otp.schema';
import { GoogleStrategy } from './strategy/google.strategy';
import { FacebookStrategy } from './strategy/facebook.strategy';
import { Course, CourseSchema } from './models/admin-course';

@Module({
  imports: [
    PassportModule,
    MailModule,
    ConfigModule,
    DatabaseModule.forFeature([
      { name: Otp.name, schema: OtpSchema },
      { name: Course.name, schema: CourseSchema }
    ]),
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, FacebookStrategy, OtpRepo],
  exports: [AuthService],
})
export class AuthModule { }
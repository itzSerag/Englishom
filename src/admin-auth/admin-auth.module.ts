import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthController } from './admin-auth.controller';
import { ConfigModule } from '../common/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AdminModule } from '../admin/admin.module';
import { AdminJwtStrategy } from './strategy/admin-jwt.strategy';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminRoleGuard } from './guards/admin-roles.guard';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    forwardRef(() => AdminModule), // Use forwardRef to avoid circular dependency
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        secret: configService.get('JWT_ADMIN_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ADMIN_EXPIRATION_TIME'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminJwtGuard,
    AdminRoleGuard,
  ],
  exports: [AdminAuthService, AdminJwtGuard, AdminRoleGuard],
})
export class AdminAuthModule {}

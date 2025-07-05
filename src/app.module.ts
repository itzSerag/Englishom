import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { CommonModule } from './common/common.module';
import { PaymentModule } from './payment/paymob.module';
import { CronModule } from './cron/cron.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { RolesGuard } from './auth/guards/role.guard';
import { VerifiedGuard } from './auth/guards/verified-user.guard';
import { UserStatusGuard } from './auth/guards/user-status.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DashboardModule } from './dashboard/dashboard.module';
import { ObjectIdTransformInterceptor } from './common/interceptors/objectid-transform.interceptor';
import { SeederModule } from './common/seeds/seeder.module';

@Module({
  imports: [
    CommonModule, // Import the global common module
    AuthModule,
    UserModule,
    AdminModule,
    PaymentModule,
    FileUploadModule,
    ConfigModule,
    DatabaseModule,
    CronModule, // Add CRON module
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 40,
        },
      ],
    }),
    DashboardModule,
    SeederModule, // Add seeder module for development data generation
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ObjectIdTransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // First, ensure user is authenticated
    },
    {
      // this guard will be applied to all routes // but not the public routes
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      // this guard will be applied to all routes // but not the public routes
      provide: APP_GUARD,
      useClass: VerifiedGuard,
    },
    {
      // Check user account status (suspended/blocked)
      provide: APP_GUARD,
      useClass: UserStatusGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

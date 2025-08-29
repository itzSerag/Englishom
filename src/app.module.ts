import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { CommonModule } from './common/common.module';
import { PaymentModule } from './payment/paymob.module';
import { CronModule } from './cron/cron.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DashboardModule } from './dashboard/dashboard.module';
import { ObjectIdTransformInterceptor } from './common/interceptors/objectid-transform.interceptor';
import { UserAuthModule } from './user-auth/user-auth.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { CourseModule } from './course/course.module';
import { SeederModule } from './common/seeds/seeder.module';

@Module({
  imports: [
    CommonModule, // Import the global common module
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
    SeederModule,
    UserAuthModule,
    AdminAuthModule,
    CourseModule, // Add seeder module for development data generation
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ObjectIdTransformInterceptor,
    },
  ],
})
export class AppModule {}

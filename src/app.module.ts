import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { PaymentModule } from './payment/paymob.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { RolesGuard } from './auth/guards/role.guard';
import { VerifiedGuard } from './auth/guards/verifed-user.guard';

@Module({
  imports: [AuthModule, UserModule, PaymentModule, FileUploadModule, ConfigModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService,
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
  ],
})
export class AppModule { }

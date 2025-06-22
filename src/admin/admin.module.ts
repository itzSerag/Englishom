import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminRepo } from './repo/admin.repo';
import { AdminSeederService } from './services/admin-seeder.service';
import { DatabaseModule } from '../common/database/database.module';
import { Admin, AdminSchema } from './models/admin.schema';
import { IsAdminGuard, AdminRoleGuard } from './guards';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from 'src/common/config/config.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRATION_TIME') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController, AdminUserController],
  providers: [
    AdminService,
    AdminRepo,
    AdminSeederService,
    IsAdminGuard,
    AdminRoleGuard,
  ],
  exports: [AdminService, AdminRepo],
})
export class AdminModule {}

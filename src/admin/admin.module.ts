import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRepo } from './repo/admin.repo';
import { AdminSeederService } from './services/admin-seeder.service';
import { DatabaseModule } from '../common/database/database.module';
import { Admin, AdminSchema } from './models/admin.schema';
import { UserModule } from '../user/user.module';
import { ConfigModule } from 'src/common/config/config.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    forwardRef(() => UserModule),
    forwardRef(() => AdminAuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRepo, AdminSeederService],
  exports: [AdminService, AdminRepo],
})
export class AdminModule {}

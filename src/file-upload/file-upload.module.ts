import { Module, forwardRef } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { AdminModule } from '../admin/admin.module';
import { UserResultsController } from './controllers/user-results.controller';
import { UserResultsService } from './services/user-results.service';
import { PaymentModule } from '../payment/paymob.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [forwardRef(() => AdminModule), PaymentModule, UserModule],
  controllers: [FileUploadController, UserResultsController],
  providers: [FileUploadService, UserResultsService],
  exports: [FileUploadService],
})
export class FileUploadModule {}

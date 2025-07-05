import { Module, forwardRef } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { LocalStorageService } from './services/local-storage.service';
import { StaticFilesController } from './controllers/static-files.controller';
import { FileAccessService } from './services/file-access.service';
import { PaymentModule } from '../payment/paymob.module';

@Module({
  imports: [forwardRef(() => PaymentModule)],
  controllers: [FileUploadController, StaticFilesController],
  providers: [FileUploadService, LocalStorageService, FileAccessService],
  exports: [FileAccessService],
})
export class FileUploadModule {}

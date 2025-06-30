import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { LocalStorageService } from './services/local-storage.service';
import { StaticFilesController } from './controllers/static-files.controller';

@Module({
  controllers: [FileUploadController, StaticFilesController],
  providers: [FileUploadService, LocalStorageService],
})
export class FileUploadModule {}

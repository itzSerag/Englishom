import { IsNotEmpty, IsString } from 'class-validator';
import { UploadFileDTO } from './lesson-upload.dto';

export class DeleteObjDTO extends UploadFileDTO {
  @IsString()
  @IsNotEmpty()
  objectId: string;
}

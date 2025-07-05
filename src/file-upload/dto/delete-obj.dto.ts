import { IsNotEmpty, IsString } from 'class-validator';
import { UploadFileDTO } from './get-content-aws';

export class DeleteObjDTO extends UploadFileDTO {
  @IsString()
  @IsNotEmpty()
  objectId: string;
}

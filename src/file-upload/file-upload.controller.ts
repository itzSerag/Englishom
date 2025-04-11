import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UploadDTO, UploadFileDTO, validateData } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { log } from 'console';
import { AllowedAudioMimeTypes, AllowedImageMimeTypes } from './enum';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { FileUploadService } from './file-upload.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('files')
export class FileUploadController {
  constructor(private uploadService: FileUploadService) { }

  @Get('')
  async getContentByName(@Query() content: UploadFileDTO) {
    const result = await this.uploadService.getContentByName(content);

    if (!result || result.length == 0) {
      throw new NotFoundException(
        `Can't find any file by this name or file is empty : ${content.lesson_name}`,
      );
    }

    return result;
  }


  // now this is about uploading and Inserting data 
  @Post('')
  @UseGuards(AdminGuard)
  async upload(@Body() dataUploadDTO: UploadDTO) {


    // ensure the data is parsed as array
    if (typeof dataUploadDTO.data === 'string') {
      try {
        dataUploadDTO.data = JSON.parse(dataUploadDTO.data);
      } catch (error) {
        throw new BadRequestException('Invalid JSON data format, ' + error);
      }
    }

    // Additional check to ensure data is an array
    if (!Array.isArray(dataUploadDTO.data)) {
      dataUploadDTO.data = [dataUploadDTO.data];
    }


    await validateData(dataUploadDTO.lesson_name, dataUploadDTO.data);
    return await this.uploadService.insertIntoJsonDataArray(dataUploadDTO);
  }


  @Post('single-file')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 20 * 1024 * 1024 // 20mb
    }
  }))

  // returns a link of the file in aws to put it within the request
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDTO: UploadFileDTO,
  ) {
    // upload to AWS and return the link
    if (!file) {
      throw new BadRequestException('File not found in request');
    }

    const allowedMimeTypes = [
      ...Object.values(AllowedAudioMimeTypes),
      ...Object.values(AllowedImageMimeTypes),
    ];

    if (!allowedMimeTypes.includes(file.mimetype as AllowedAudioMimeTypes)) {
      throw new BadRequestException(
        'Only Audio and images files are allowed to be uploaded.',
      );
    }

    console.log(uploadFileDTO);
    return await this.uploadService.uploadSingleFile(file, uploadFileDTO);
  }


  // delete an obj in data array
  @UseGuards(AdminGuard)
  @Delete('delete-obj')
  async deleteFromJsonDataArray(
    @Query() deleteObjDTO: DeleteObjDTO) {

    return await this.uploadService.deleteFromJsonDataArray(deleteObjDTO);

  }


  // delete the whole file
  @UseGuards(AdminGuard)
  @Delete()
  async deleteFile(@Body() uploadFileDTO: UploadFileDTO) {
    const res = await this.uploadService.deleteFile(uploadFileDTO);
    if (!res) {
      throw new NotFoundException(
        `Can't find any file by this name : ${uploadFileDTO.lesson_name}`,
      );
    }
    log(res);
    return { message: 'File deleted successfully' };
  }



}

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
  Param,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { UploadDTO, UploadFileDTO, validateData } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { log } from 'console';
import { AllowedAudioMimeTypes, AllowedImageMimeTypes } from './enum';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { FileUploadService } from './file-upload.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { Level_Name } from '../common/shared/enums';

@Controller('files')
export class FileUploadController {
  constructor(private uploadService: FileUploadService) { }

  @Get('')
  async getContentByName(@Query(ValidationPipe) content: UploadFileDTO) {
    const result = await this.uploadService.getContentByName(content);

    if (!result || !result.data || result.data.length === 0) {
      throw new NotFoundException(
        `Can't find any file by this name or file is empty : ${content.lesson_name}`,
      );
    }

    return result;
  }

  @Get('user-audio')
  async getUserAudios(@CurrentUser() user: User) {
    return await this.uploadService.getUserAudios(user._id.toString());
  }

  @Get('user-audio/:levelName')
  async getUserAudiosByLevel(
    @CurrentUser() user: User,
    @Param('levelName') levelName: string
  ) {
    return await this.uploadService.getUserAudiosByLevel(
      user._id.toString(),
      levelName
    );
  }

  @Get('user-audio/:levelName/:day')
  async getUserDayAudio(
    @CurrentUser() user: User,
    @Param('levelName') levelName: Level_Name,
    @Param('day') day: string
  ) {
    const audio = await this.uploadService.getUserDayAudio(
      user._id.toString(),
      levelName,
      day
    );

    if (!audio) {
      throw new NotFoundException('No audio found for this day');
    }

    return audio;
  }

  @Post('user-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20mb
      },
    }),
  )
  async uploadUserAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDTO: UploadFileDTO,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('File not found in request');
    }

    const allowedMimeTypes = [
      ...Object.values(AllowedAudioMimeTypes),
    ];

    if (!allowedMimeTypes.includes(file.mimetype as AllowedAudioMimeTypes)) {
      throw new BadRequestException(
        'Only audio files are allowed to be uploaded.',
      );
    }

    return await this.uploadService.uploadUserAudio(
      file,
      uploadFileDTO,
      user._id.toString()
    );
  }


  @Delete('user-audio')
  async deleteUserAudio(
    @CurrentUser() user: User,
    @Query('audioKey') audioKey: string
  ) {

    const decodedKey = decodeURIComponent(audioKey); // just in case
    // Extract userId from the audioKey path
    // audioKey format: UserAudios/userId/levelName/day/day_audio.mp3
    const keyParts = decodedKey.split('/');


    if (keyParts.length < 2) {
      log('Invalid audio key format:', keyParts);
      log('Decoded key:', decodedKey);
      log('Original key:', audioKey);
      log('keyParts:', keyParts.length);
      throw new BadRequestException('Invalid audio key format');
    }

    const audioUserId = keyParts[1]; // Get userId from path

    if (audioUserId !== user._id.toString()) {
      throw new ForbiddenException('Access denied. ')
    }

    await this.uploadService.deleteUserAudio(user._id.toString(), audioKey);
    return { message: 'Audio file deleted successfully' };
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20mb
      },
    }),
  )

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
  async deleteFromJsonDataArray(@Query() deleteObjDTO: DeleteObjDTO) {
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

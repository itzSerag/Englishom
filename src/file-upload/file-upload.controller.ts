import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
  Param,
  ForbiddenException,
  ValidationPipe,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { UploadDTO, UploadFileDTO, validateData } from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AllowedAudioMimeTypes, AllowedImageMimeTypes } from './enum';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { FileUploadService } from './file-upload.service';
import { CurrentUser } from '../user-auth/decorator/get-curr-user.decorator';
import { User } from '../user/models/user.schema';
import { AdminRole, Level_Name } from '../common/shared/enums';
import { AdminRoles } from 'src/admin-auth/decorators';
import { AdminRoleGuard, AdminJwtGuard } from '../admin-auth/guards';

@Controller('files')
export class FileUploadController {
  private readonly logger = new Logger(FileUploadController.name);

  constructor(private readonly uploadService: FileUploadService) {}

  @Get('')
  async getContentByName(@Query(ValidationPipe) content: UploadFileDTO) {
    const result = await this.uploadService.getContentByName(content);
    return result; // Service now always returns { data: [] } if no content
  }

  @Get('user-audio')
  async getUserAudios(@CurrentUser() user: User) {
    return await this.uploadService.getUserAudios(user._id.toString());
  }

  @Get('user-audio/:levelName')
  async getUserAudiosByLevel(
    @CurrentUser() user: User,
    @Param('levelName') levelName: string,
  ) {
    return await this.uploadService.getUserAudiosByLevel(
      user._id.toString(),
      levelName,
    );
  }

  @Get('user-audio/:levelName/:day')
  async getUserDayAudio(
    @CurrentUser() user: User,
    @Param('levelName') levelName: Level_Name,
    @Param('day') day: string,
  ) {
    try {
      const audio = await this.uploadService.getUserDayAudio(
        user._id.toString(),
        levelName,
        day,
      );

      if (!audio) {
        throw new NotFoundException('No audio found for this day');
      }

      return audio;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting user day audio: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    this.validateAudioFile(file);

    return await this.uploadService.uploadUserAudio(
      file,
      uploadFileDTO,
      user._id.toString(),
    );
  }

  @Delete('user-audio')
  async deleteUserAudio(
    @CurrentUser() user: User,
    @Query('audioKey') audioKey: string,
  ) {
    if (!audioKey) {
      throw new BadRequestException('audioKey is required');
    }

    const decodedKey = decodeURIComponent(audioKey);
    const keyParts = decodedKey.split('/');

    if (keyParts.length < 2) {
      this.logger.warn('Invalid audio key format', {
        decodedKey,
        originalKey: audioKey,
        keyPartsLength: keyParts.length,
      });
      throw new BadRequestException('Invalid audio key format');
    }

    const audioUserId = keyParts[1];

    if (audioUserId !== user._id.toString()) {
      throw new ForbiddenException(
        'You do not have permission to delete this audio file',
      );
    }

    await this.uploadService.deleteUserAudio(user._id.toString(), audioKey);
    return { message: 'Audio file deleted successfully' };
  }

  // Content upload - OPERATOR+ can upload content
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER, AdminRole.OPERATOR)
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @Post('')
  async upload(@Body() dataUploadDTO: UploadDTO) {
    dataUploadDTO.data = this.parseData(dataUploadDTO.data);
    await validateData(dataUploadDTO.lesson_name, dataUploadDTO.data);
    await this.uploadService.insertIntoJsonDataArray(dataUploadDTO);
    return { message: 'Data uploaded successfully' };
  }

  // Single file upload - OPERATOR+ can upload content
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER, AdminRole.OPERATOR)
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @Post('single-file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20mb
      },
    }),
  )
  async uploadSingleFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDTO: UploadFileDTO,
  ) {
    this.validateMediaFile(file);
    return await this.uploadService.uploadSingleFile(file, uploadFileDTO);
  }

  // Delete from JSON data array - MANAGER+ can delete content
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @Delete('delete-obj')
  async deleteFromJsonDataArray(@Query() deleteObjDTO: DeleteObjDTO) {
    await this.uploadService.deleteFromJsonDataArray(deleteObjDTO);
    return { message: 'Object deleted successfully' };
  }

  // Delete file - MANAGER+ can delete content
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @Delete()
  async deleteFile(@Body() uploadFileDTO: UploadFileDTO) {
    try {
      const res = await this.uploadService.deleteFile(uploadFileDTO);
      if (!res) {
        throw new NotFoundException(
          `Can't find any file by this name: ${uploadFileDTO.lesson_name}`,
        );
      }
      return { message: 'File deleted successfully' };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw new NotFoundException(
          `Can't find any file by this name: ${uploadFileDTO.lesson_name}`,
        );
      }
      throw error;
    }
  }

  private parseData(data: any): any[] {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (error) {
        throw new BadRequestException(
          `Invalid JSON data format: ${error.message}`,
        );
      }
    }

    if (!Array.isArray(data)) {
      data = [data];
    }

    return data;
  }

  private validateAudioFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File not found in request');
    }

    const allowedMimeTypes = Object.values(AllowedAudioMimeTypes);

    if (!allowedMimeTypes.includes(file.mimetype as AllowedAudioMimeTypes)) {
      throw new BadRequestException(
        'Only audio files are allowed to be uploaded.',
      );
    }
  }

  private validateMediaFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File not found in request');
    }

    const allowedMimeTypes = [
      ...Object.values(AllowedAudioMimeTypes),
      ...Object.values(AllowedImageMimeTypes),
    ];

    if (!allowedMimeTypes.includes(file.mimetype as AllowedAudioMimeTypes)) {
      throw new BadRequestException(
        'Only audio and image files are allowed to be uploaded.',
      );
    }
  }
}

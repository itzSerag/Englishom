import {
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadDTO, UploadFileDTO } from './dto';
import { v4 as uuidv4 } from 'uuid';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { LocalStorageService } from './services/local-storage.service';

enum FileType {
  IMAGE = 'Images',
  AUDIO = 'Audio',
}

export interface JsonFile {
  data: any[];
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  async uploadSingleFile(
    file: Express.Multer.File,
    uploadFileDTO: UploadFileDTO,
  ): Promise<{ url: string }> {
    this.validateFile(file);

    const fileTypePath = this.determineFileType(file.mimetype);
    const key = this.generateFileKey(
      fileTypePath,
      uploadFileDTO,
      file.originalname.trim().replace(/\s+/g, '_'),
    );

    try {
      return await this.localStorageService.uploadFile(file, key);
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message}`,
      );
    }
  }

  async uploadUserAudio(
    file: Express.Multer.File,
    uploadFileDTO: UploadFileDTO,
    userId: string,
  ): Promise<{ url: string }> {
    this.validateFile(file);

    const fileTypePath = 'UserAudios';
    const key = `${fileTypePath}/${userId}/${uploadFileDTO.level_name}/${uploadFileDTO.day}/today_audio.mp3`;

    try {
      return await this.localStorageService.uploadFile(file, key);
    } catch (error) {
      this.logger.error(
        `Failed to upload user audio: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to upload user audio: ${error.message}`,
      );
    }
  }

  async getUserAudios(userId: string): Promise<{ url: string }[]> {
    return this.localStorageService.listFiles(`UserAudios/${userId}/`);
  }

  async getUserAudiosByLevel(
    userId: string,
    levelName: string,
  ): Promise<{ url: string }[]> {
    return this.localStorageService.listFiles(
      `UserAudios/${userId}/${levelName}/`,
    );
  }

  async getUserDayAudio(
    userId: string,
    levelName: string,
    day: string,
  ): Promise<{ url: string } | null> {
    const key = `UserAudios/${userId}/${levelName}/${day}/today_audio.mp3`;

    try {
      this.logger.debug(`Checking for audio file at key: ${key}`);
      const fileExists = await this.localStorageService.fileExists(key);
      if (fileExists) {
        return this.localStorageService.getFileUrl(key);
      } else {
        this.logger.debug(
          `No audio file found for user ${userId} in level ${levelName} day ${day}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving day audio: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve day audio: ${error.message}`,
      );
    }
  }

  async deleteUserAudio(userId: string, audioKey: string): Promise<void> {
    const key = audioKey.startsWith('UserAudios/')
      ? audioKey
      : `UserAudios/${audioKey}`;

    try {
      await this.localStorageService.deleteFile(key);
      this.logger.debug(`Successfully deleted local audio file: ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete audio file: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete user audio: ${error.message}`,
      );
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new NotAcceptableException('File is required');
    }

    const fileTypePath = this.determineFileType(file.mimetype);
    if (!fileTypePath) {
      throw new NotAcceptableException(
        'Unsupported file type. Only images and audio files are allowed.',
      );
    }
  }

  async insertIntoJsonDataArray(uploadFileDTO: UploadDTO): Promise<void> {
    const key = this.createJsonKey(uploadFileDTO);

    try {
      const jsonData = await this.getOrInitializeJsonData(key);

      // Assign unique IDs to items if they don't have one
      uploadFileDTO.data.forEach((item) => {
        if (!item.id) {
          item.id = uuidv4();
        }
      });

      this.validateJsonDataArray(jsonData);
      jsonData.data.push(...uploadFileDTO.data);

      await this.updateJsonLocal(key, jsonData);
    } catch (error) {
      this.logger.error(
        `Failed to insert object into JSON data array: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to insert object into JSON data array: ${error.message}`,
      );
    }
  }

  async deleteFromJsonDataArray(deleteObjDTO: DeleteObjDTO): Promise<void> {
    const { objectId, ...uploadDTO } = deleteObjDTO;
    const key = this.createJsonKey(uploadDTO as UploadFileDTO);

    try {
      const jsonData = await this.getJsonFromLocal(key);

      this.validateJsonDataArray(jsonData);
      const initialLength = jsonData.data.length;

      jsonData.data = jsonData.data.filter(
        (item) => item.id !== objectId.toString(),
      );

      if (jsonData.data.length === initialLength) {
        throw new NotFoundException(`Object with ID ${objectId} not found`);
      }

      await this.updateJsonLocal(key, jsonData);
    } catch (error) {
      this.logger.error('Error in deleteFromJsonDataArray:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete object: ${error.message}`,
      );
    }
  }

  async deleteFile(uploadFileDTO: UploadFileDTO): Promise<void> {
    const key = this.createJsonKey(uploadFileDTO);

    try {
      await this.localStorageService.deleteFile(key, 'json');
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete file: ${error.message}`,
      );
    }
  }

  async getContentByName(uploadFileDTO: UploadFileDTO): Promise<JsonFile> {
    const key = this.createJsonKey(uploadFileDTO);

    try {
      return await this.getJsonFromLocal(key);
    } catch (error) {
      this.logger.error(
        `Failed to get content by name: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        return { data: [] }; // Return empty data array if file not found
      }
      throw new InternalServerErrorException('Failed to retrieve content');
    }
  }

  private createJsonKey(uploadDTO: UploadDTO | UploadFileDTO): string {
    return `Levels/${uploadDTO.level_name}/${uploadDTO.day}/${uploadDTO.lesson_name}.json`;
  }

  private determineFileType(mimetype: string): FileType | null {
    if (mimetype.includes('image')) return FileType.IMAGE;
    if (mimetype.includes('audio')) return FileType.AUDIO;
    return null;
  }

  private generateFileKey(
    fileTypePath: FileType,
    uploadFileDTO: UploadFileDTO,
    originalName: string,
  ): string {
    return `${fileTypePath}/${uploadFileDTO.level_name}/${uploadFileDTO.day}/${uploadFileDTO.lesson_name}/${originalName}`;
  }

  private async getOrInitializeJsonData(key: string): Promise<JsonFile> {
    try {
      return await this.getJsonFromLocal(key);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { data: [] };
      }
      throw error;
    }
  }

  private validateJsonDataArray(jsonData: JsonFile): void {
    if (!jsonData || !Array.isArray(jsonData.data)) {
      throw new InternalServerErrorException('Invalid JSON data structure');
    }
  }

  private async getJsonFromLocal(key: string): Promise<JsonFile> {
    try {
      const fileBuffer = await this.localStorageService.getFile(key, 'json');
      return JSON.parse(fileBuffer.toString());
    } catch (error) {
      this.logger.error(
        `Failed to get or parse JSON from local storage: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`JSON file not found: ${key}`);
      }
      throw new InternalServerErrorException(
        'Failed to retrieve or parse JSON data',
      );
    }
  }

  private async updateJsonLocal(key: string, data: JsonFile): Promise<void> {
    try {
      const fileBuffer = Buffer.from(JSON.stringify(data, null, 2));
      const tempFile: Express.Multer.File = {
        buffer: fileBuffer,
        originalname: key,
        fieldname: '',
        encoding: '',
        mimetype: 'application/json',
        size: fileBuffer.length,
        stream: null,
        destination: '',
        filename: '',
        path: '',
      };
      await this.localStorageService.uploadFile(tempFile, key, 'json');
    } catch (error) {
      this.logger.error(
        `Failed to update JSON in local storage: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update JSON data');
    }
  }
}

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  NotAcceptableException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadDTO, UploadFileDTO } from './dto';
import { v4 as uuid } from 'uuid';
import { DeleteObjDTO } from './dto/delete-obj.dto';

enum FileType {
  IMAGE = 'Images',
  AUDIO = 'Audio',
}

interface S3Config {
  bucket: string;
  resBucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface JsonFile {
  data: any[];
}

@Injectable()
export class FileUploadService {
  private readonly s3Config: S3Config;
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly configService: ConfigService) {
    this.s3Config = this.loadS3Configuration();
    this.s3Client = this.createS3Client();
  }

  private loadS3Configuration(): S3Config {
    return {
      bucket: this.configService.getOrThrow('AWS_S3_BUCKET'),
      resBucket: this.configService.getOrThrow('AWS_S3_BUCKET_RES'),
      region: this.configService.getOrThrow('AWS_REGION'),
      accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
    };
  }

  private createS3Client(): S3Client {
    return new S3Client({
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
    });
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    uploadFileDTO: UploadFileDTO,
  ): Promise<{ url: string }> {
    this.validateFile(file);

    const fileTypePath = this.determineFileType(file.mimetype);
    const key = this.generateFileKey(
      fileTypePath,
      uploadFileDTO,
      file.originalname.trim().replaceAll(/\s+/g, '_'),
    );

    try {
      await this.uploadToS3(file, key);
      return this.getFileUrl(key, this.s3Config.resBucket);
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
      await this.uploadToS3(file, key);
      return this.getFileUrl(key, this.s3Config.resBucket);
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
    return this.listObjectsWithPrefix(`UserAudios/${userId}/`);
  }

  async getUserAudiosByLevel(
    userId: string,
    levelName: string,
  ): Promise<{ url: string }[]> {
    return this.listObjectsWithPrefix(`UserAudios/${userId}/${levelName}/`);
  }

  private async listObjectsWithPrefix(
    prefix: string,
  ): Promise<{ url: string }[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.s3Config.resBucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      return (response.Contents || []).map((object) => ({
        url: this.getFileUrl(object.Key, this.s3Config.resBucket).url,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to list objects with prefix ${prefix}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve objects: ${error.message}`,
      );
    }
  }

  async getUserDayAudio(
    userId: string,
    levelName: string,
    day: string,
  ): Promise<{ url: string } | null> {
    const key = `UserAudios/${userId}/${levelName}/${day}/today_audio.mp3`;

    try {
      this.logger.debug(`Checking for audio file at key: ${key}`);

      const command = new HeadObjectCommand({
        Bucket: this.s3Config.resBucket,
        Key: key,
      });

      try {
        await this.s3Client.send(command);
        return this.getFileUrl(key, this.s3Config.resBucket);
      } catch (error) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
          this.logger.debug(
            `No audio file found for user ${userId} in level ${levelName} day ${day}`,
          );
          return null;
        }
        throw error;
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
      // First verify the file exists
      const headCommand = new HeadObjectCommand({
        Bucket: this.s3Config.resBucket,
        Key: key,
      });

      try {
        await this.s3Client.send(headCommand);
      } catch (error) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
          throw new NotFoundException(`Audio file not found: ${key}`);
        }
        throw error;
      }

      // If file exists, delete it
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.s3Config.resBucket,
        Key: key,
      });

      await this.s3Client.send(deleteCommand);
      this.logger.debug(`Successfully deleted audio file: ${key}`);
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
      for (const item of uploadFileDTO.data) {
        if (!item.id) {
          item.id = uuid();
        }
      }

      this.validateJsonDataArray(jsonData);
      jsonData.data.push(...uploadFileDTO.data);

      await this.updateJsonInS3(key, jsonData);
      
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
    const key = this.createJsonKey(uploadDTO);

    try {
      const jsonData = await this.getJsonFromS3(key, this.s3Config.bucket);

      this.validateJsonDataArray(jsonData);
      const initialLength = jsonData.data.length;

      jsonData.data = jsonData.data.filter(
        (item) => item.id !== objectId.toString(),
      );

      if (jsonData.data.length === initialLength) {
        throw new NotFoundException(`Object with ID ${objectId} not found`);
      }

      await this.updateJsonInS3(key, jsonData);
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

  async deleteFile(uploadFileDTO: UploadFileDTO) {
    const key = this.createJsonKey(uploadFileDTO);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: key,
      });

      return await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to delete file: ${error.message}`,
      );
    }
  }

  async getContentByName(uploadFileDTO: UploadFileDTO) {
    const key = this.createJsonKey(uploadFileDTO);

    try {
      const signedUrl = await this.getPresignedSignedUrl(
        key,
        this.s3Config.bucket,
      );

      if (!signedUrl.url) {
        return { data: [] };
      }

      const response = await fetch(signedUrl.url);

      if (!response.ok) {
        return { data: [] };
      }

      const data = await response.json();

      // Ensure data has the correct structure
      if (!data?.data) {
        return { data: [] };
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to get content by name: ${error.message}`,
        error.stack,
      );
      // Return empty data array instead of throwing an error
      return { data: [] };
    }
  }

  async getAudioBufferFromS3(s3Key: string): Promise<Buffer> {
    const params = {
      Bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      Key: s3Key,
    };

    try {
        const command = new GetObjectCommand(params);
      const response = await this.s3Client.send(command);
      const dataBodyString = await response.Body.transformToByteArray();
      
      if (!dataBodyString) {
        throw new Error('No audio data found in S3 response');
      }

      // Body is already a Buffer when from S3
      return dataBodyString as Buffer;
    } catch (error) {
      throw new Error(`Failed to fetch audio from S3: ${error.message}`);
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

  private async uploadToS3(
    file: Express.Multer.File,
    key: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.s3Config.resBucket,
      Body: file.buffer,
      Key: key,
      ACL: 'public-read',
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }

  private async getOrInitializeJsonData(key: string): Promise<JsonFile> {
    try {
      return await this.getJsonFromS3(key, this.s3Config.bucket);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve JSON: ${error.message}`,
        error.stack,
      );
      // If file does not exist, initialize a new JSON structure
      return { data: [] };
    }
  }

  private validateJsonDataArray(jsonData: JsonFile): void {
    if (!jsonData.data) {
      jsonData.data = [];
      return;
    }

    if (!Array.isArray(jsonData.data)) {
      throw new InternalServerErrorException(
        'Invalid JSON structure: "data" is not an array',
      );
    }
  }

  private async getJsonFromS3(key: string, bucket: string): Promise<JsonFile> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);
      const jsonString = await response.Body.transformToString();
      const parsed = JSON.parse(jsonString);

      // Ensure data property exists
      if (!parsed.data) {
        parsed.data = [];
      }

      return parsed;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve JSON: ${error.message}`,
        error.stack,
      );
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return { data: [] };
      }
      throw new InternalServerErrorException(
        `Failed to retrieve JSON: ${error.message}`,
      );
    }
  }


  /**
   * This overwrites the entire JSON file in S3 with the provided data.
   * Use with caution to avoid data loss. 
   */

  private async updateJsonInS3(key: string, data: JsonFile): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      const command = new PutObjectCommand({
        Bucket: this.s3Config.bucket,
        Key: key,
        Body: jsonString,
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.logger.log(`JSON updated successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to update JSON: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to update JSON: ${error.message}`,
      );
    }
  }

  private async getPresignedSignedUrl(
    key: string,
    bucket: string,
  ): Promise<{ url: string | null }> {
    try {
      const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
      await this.s3Client.send(headCommand);

      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return {
        url: await getSignedUrl(this.s3Client, command, { expiresIn: 86400 }),
      };
    } catch (err) {
      this.logger.warn(
        `File not found or access denied: ${key}  - ${err.message}`,
      );
      return { url: null };
    }
  }

  private getFileUrl(key: string, bucket: string): { url: string } {
    const region = this.s3Config.region;
    const encodedKey = encodeURIComponent(key);
    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`,
    };
  }

}

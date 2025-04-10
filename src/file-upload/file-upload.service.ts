import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
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
import { v4 as uuidv4 } from 'uuid';
import { DeleteObjDTO } from './dto/delete-obj.dto';

enum FileType {
    IMAGE = 'Images',
    AUDIO = "Audio",
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
export class UploadService {
    private readonly s3Config: S3Config;
    private readonly s3Client: S3Client;
    private readonly logger = new Logger(UploadService.name);

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
    ) {
        this.validateFile(file);

        const fileTypePath = this.determineFileType(file.mimetype);
        const key = this.generateFileKey(fileTypePath, uploadFileDTO, file.originalname);

        try {
            await this.uploadToS3(file, key);
            return this.getFileUrl(key, this.s3Config.resBucket);
        } catch (error) {
            throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
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

    async insertIntoJsonDataArray(
        uploadFileDTO: UploadDTO,
    ): Promise<void> {
        const key = this.createJsonKey(uploadFileDTO);

        try {
            const jsonData = await this.getOrInitializeJsonData(key);

            // Iterate over the data array and assign a unique id to each object if it doesn't already have one
            uploadFileDTO.data.forEach(item => {
                if (!item.id) {
                    item.id = uuidv4();
                }
            });

            this.validateJsonDataArray(jsonData);
            jsonData.data.push(...uploadFileDTO.data);

            await this.updateJsonInS3(key, jsonData);
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to insert object into JSON data array: ${error.message}`,
            );
        }
    }

    async deleteFromJsonDataArray(
        deleteObjDTO: DeleteObjDTO
    ): Promise<void> {
        const { objectId, ...uploadDTO } = deleteObjDTO;
        const key = this.createJsonKey(uploadDTO);

        try {
            const jsonData = await this.getJsonFromS3(key, this.s3Config.bucket);

            this.validateJsonDataArray(jsonData);
            const initialLength = jsonData.data.length;
            // Use strict equality comparison
            jsonData.data = jsonData.data.filter((item) => {
                return item.id !== deleteObjDTO.objectId.toString();
            });

            if (jsonData.data.length === initialLength) {
                throw new NotFoundException(`Object with ID ${objectId} not found`);
            }

            await this.updateJsonInS3(key, jsonData);
        } catch (error) {

            console.error('Error in deleteFromJsonDataArray:', error);
            throw new InternalServerErrorException(
                `Failed to delete object: ${error.message}`,
            );
        }

    }

    async deleteFile(uploadFileDTO: UploadFileDTO) {
        const key = `Levels/${uploadFileDTO.level_name}/${uploadFileDTO.day}/${uploadFileDTO.lesson_name}.json`;

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.s3Config.bucket,
                Key: key,
            });

            return await this.s3Client.send(command);
        } catch (error) {
            throw new InternalServerErrorException('Failed to delete file, ' + error);
        }
    }

    async getContentByName(uploadFileDTO: UploadFileDTO) {

        const key = `Levels/${uploadFileDTO.level_name}/${uploadFileDTO.day}/${uploadFileDTO.lesson_name}.json`;
        const signedUrl = await this.getPresignedSignedUrl(key, this.s3Config.bucket);

        if (!signedUrl) return null;

        const response = await fetch(signedUrl.url);
        if (!response.ok) return null;

        return await response.json();
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
        return `${fileTypePath}/${uploadFileDTO.level_name}/${uploadFileDTO.day}/${originalName}`;
    }

    private async uploadToS3(
        file: Express.Multer.File,
        key: string,
    ): Promise<void> {

        // notice its a put command 
        const command = new PutObjectCommand({
            Bucket: this.s3Config.resBucket,
            Body: file.buffer,
            Key: key,
            ACL: 'public-read',
        });

        try {
            await this.s3Client.send(command);
        } catch (error) {
            throw new InternalServerErrorException('Failed to upload file to S3,' + error);
        }
    }

    private async getOrInitializeJsonData(key: string): Promise<JsonFile> {
        try {

            return await this.getJsonFromS3(key, this.s3Config.bucket);

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // If file does not exist, initialize a new JSON structure
            return { data: [] };
        }
    }

    private validateJsonDataArray(jsonData: JsonFile): void {
        if (!Array.isArray(jsonData.data)) {
            throw new InternalServerErrorException('Invalid JSON structure: "data" is not an array');
        }
    }

    private async getJsonFromS3(key: string, bucket: string) {
        try {
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await this.s3Client.send(command);
            const jsonString = await response.Body.transformToString();
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error(`Failed to retrieve JSON: ${error.message}`);
            throw new InternalServerErrorException(`Failed to retrieve JSON: ${error.message}`);
        }
    }

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
            this.logger.error(`Failed to update JSON: ${error.message}`);
            throw new InternalServerErrorException(`Failed to update JSON: ${error.message}`);
        }
    }

    private async getPresignedSignedUrl(key: string, bucket: string) {
        try {
            const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
            await this.s3Client.send(headCommand);

            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            return { url: await getSignedUrl(this.s3Client, command, { expiresIn: 86400 }) };
        } catch (err) {
            this.logger.error(`Failed to get presigned URL: ${err.message}`);
            throw new NotFoundException('File not found');
        }
    }

    private getFileUrl(key: string, bucket: string) {
        return { url: `https://${bucket}.s3.amazonaws.com/${key}` };
    }
}
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileStorageInterface } from '../interfaces/storage.interface';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalStorageService implements FileStorageInterface {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly storagePath: string;
  private readonly storageUrl: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>('LOCAL_STORAGE_PATH') || './uploads';
    // Convert relative path to absolute path to avoid working directory issues
    this.storagePath = path.isAbsolute(configuredPath) 
      ? configuredPath 
      : path.resolve(process.cwd(), configuredPath);
    this.storageUrl = this.configService.get<string>('LOCAL_STORAGE_URL') || 'http://localhost:3000/uploads';
    
    this.logger.log(`LocalStorageService initialized - Storage path: ${this.storagePath}, URL: ${this.storageUrl}`);
    
    this.ensureStorageDirectories();
  }

  private async ensureStorageDirectories(): Promise<void> {
    try {
      this.logger.log(`Creating storage directories at: ${this.storagePath}`);
      
      await fs.mkdir(this.storagePath, { recursive: true });
      const imagePath = path.join(this.storagePath, 'Images');
      await fs.mkdir(imagePath, { recursive: true });
      const audioPath = path.join(this.storagePath, 'Audio');
      await fs.mkdir(audioPath, { recursive: true });
      const userAudioPath = path.join(this.storagePath, 'UserAudios');
      await fs.mkdir(userAudioPath, { recursive: true });
      const jsonPath = path.join(this.storagePath, 'json');
      await fs.mkdir(jsonPath, { recursive: true });
      
      this.logger.log(`All storage directories created successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to create storage directories at ${this.storagePath}: ${error.message}`);
      throw new InternalServerErrorException(`Storage initialization failed: ${error.message}`);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    key: string,
    bucket?: string,
  ): Promise<{ url: string }> {
    try {
      const filePath = this.getLocalPath(key, bucket);
      const dirPath = path.dirname(filePath);

      this.logger.log(`Uploading file: ${key}`);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file to local storage
      await fs.writeFile(filePath, file.buffer);
      this.logger.log(`File uploaded successfully: ${filePath}, size: ${file.buffer.length} bytes`);

      const result = this.getFileUrl(key, bucket);
      return result;
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to upload file: ${error.message}`,
      );
    }
  }

  async deleteFile(key: string, bucket?: string): Promise<void> {
    try {
      const filePath = this.getLocalPath(key, bucket);
      
      // Check if file exists
      if (!(await this.fileExists(key, bucket))) {
        throw new NotFoundException(`File not found: ${key}`);
      }

      await fs.unlink(filePath);
      this.logger.debug(`File deleted successfully: ${key}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to delete file: ${error.message}`,
      );
    }
  }

  getFileUrl(key: string, bucket?: string): { url: string } {
    // Simple URL generation without encoding to avoid mismatches
    const url = `${this.storageUrl}/${key}`;
    
    this.logger.debug(`getFileUrl - key: ${key}, url: ${url}`);
    return { url };
  }

  async fileExists(key: string, bucket?: string): Promise<boolean> {
    try {
      const filePath = this.getLocalPath(key, bucket);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(prefix: string, bucket?: string): Promise<{ url: string }[]> {
    try {
      const searchPath = this.getLocalPath(prefix, bucket);
      const searchDir = path.dirname(searchPath);
      const prefixName = path.basename(prefix);

      const files = await this.getFilesRecursively(searchDir, prefixName);
      
      return files.map((file) => {
        const relativePath = path.relative(this.storagePath, file);
        return this.getFileUrl(relativePath, bucket);
      });
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to list files: ${error.message}`,
      );
    }
  }

  async getFile(key: string, bucket?: string): Promise<Buffer> {
    try {
      const filePath = this.getLocalPath(key, bucket);
      
      if (!(await this.fileExists(key, bucket))) {
        throw new NotFoundException(`File not found: ${key}`);
      }

      return await fs.readFile(filePath);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get file: ${error.message}`,
      );
    }
  }

  private getLocalPath(key: string, bucket?: string): string {
    let localPath: string;
    if (bucket === 'json') {
      localPath = path.join(this.storagePath, 'json', key);
    } else {
      localPath = path.join(this.storagePath, key);
    }
    
    return localPath;
  }

  private async getFilesRecursively(dir: string, prefix?: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFilesRecursively(fullPath, prefix);
          files.push(...subFiles);
        } else if (!prefix || entry.name.startsWith(prefix)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read, return empty array
      return [];
    }
    
    return files;
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
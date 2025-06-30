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
    this.storagePath = this.configService.get<string>('LOCAL_STORAGE_PATH') || './uploads';
    this.storageUrl = this.configService.get<string>('LOCAL_STORAGE_URL') || 'http://localhost:3000/uploads';
    this.ensureStorageDirectories();
  }

  private async ensureStorageDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'Images'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'Audio'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'UserAudios'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'json'), { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create storage directories: ${error.message}`);
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

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Write file to local storage
      await fs.writeFile(filePath, file.buffer);

      this.logger.debug(`File uploaded successfully: ${key}`);
      return this.getFileUrl(key, bucket);
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
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
    // Create URL-safe path by encoding the key
    const encodedKey = encodeURIComponent(key);
    return {
      url: `${this.storageUrl}/${encodedKey}`,
    };
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
    if (bucket === 'json') {
      return path.join(this.storagePath, 'json', key);
    }
    return path.join(this.storagePath, key);
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
}
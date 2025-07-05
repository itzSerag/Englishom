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
    
    // Enhanced production debugging
    this.logger.log(`[PRODUCTION DEBUG] LocalStorageService initialized`);
    this.logger.log(`[PRODUCTION DEBUG] Raw LOCAL_STORAGE_PATH: ${this.configService.get<string>('LOCAL_STORAGE_PATH')}`);
    this.logger.log(`[PRODUCTION DEBUG] Configured path: ${configuredPath}`);
    this.logger.log(`[PRODUCTION DEBUG] Storage path resolved to: ${this.storagePath}`);
    this.logger.log(`[PRODUCTION DEBUG] Raw LOCAL_STORAGE_URL: ${this.configService.get<string>('LOCAL_STORAGE_URL')}`);
    this.logger.log(`[PRODUCTION DEBUG] Storage URL: ${this.storageUrl}`);
    this.logger.log(`[PRODUCTION DEBUG] Current working directory: ${process.cwd()}`);
    this.logger.log(`[PRODUCTION DEBUG] Node environment: ${process.env.NODE_ENV}`);
    
    this.ensureStorageDirectories();
  }

  private async ensureStorageDirectories(): Promise<void> {
    try {
      this.logger.log(`[PRODUCTION DEBUG] Creating storage directories at: ${this.storagePath}`);
      
      await fs.mkdir(this.storagePath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Created base directory: ${this.storagePath}`);
      
      const imagePath = path.join(this.storagePath, 'Images');
      await fs.mkdir(imagePath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Created Images directory: ${imagePath}`);
      
      const audioPath = path.join(this.storagePath, 'Audio');
      await fs.mkdir(audioPath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Created Audio directory: ${audioPath}`);
      
      const userAudioPath = path.join(this.storagePath, 'UserAudios');
      await fs.mkdir(userAudioPath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Created UserAudios directory: ${userAudioPath}`);
      
      const jsonPath = path.join(this.storagePath, 'json');
      await fs.mkdir(jsonPath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Created json directory: ${jsonPath}`);
      
      this.logger.log(`[PRODUCTION DEBUG] All storage directories ensured successfully`);
      
      // Verify directories exist and are writable
      const stats = await fs.stat(this.storagePath);
      this.logger.log(`[PRODUCTION DEBUG] Storage path stats - isDirectory: ${stats.isDirectory()}, mode: ${stats.mode.toString(8)}`);
      
    } catch (error) {
      this.logger.error(`[PRODUCTION DEBUG] Failed to create storage directories at ${this.storagePath}: ${error.message}`);
      this.logger.error(`[PRODUCTION DEBUG] Error details:`, error);
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

      // Enhanced production debugging
      this.logger.log(`[PRODUCTION DEBUG] Upload request - key: ${key}, bucket: ${bucket}`);
      this.logger.log(`[PRODUCTION DEBUG] File original name: ${file.originalname}`);
      this.logger.log(`[PRODUCTION DEBUG] Storage path: ${this.storagePath}`);
      this.logger.log(`[PRODUCTION DEBUG] Local file path: ${filePath}`);
      this.logger.log(`[PRODUCTION DEBUG] Directory path: ${dirPath}`);
      this.logger.log(`[PRODUCTION DEBUG] Current working directory: ${process.cwd()}`);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.log(`[PRODUCTION DEBUG] Directory created/verified: ${dirPath}`);

      // Write file to local storage
      await fs.writeFile(filePath, file.buffer);
      this.logger.log(`[PRODUCTION DEBUG] File written successfully: ${filePath}, size: ${file.buffer.length} bytes`);

      // Verify file was actually written
      const fileExists = await this.fileExists(key, bucket);
      this.logger.log(`[PRODUCTION DEBUG] File exists after upload: ${fileExists}`);

      if (fileExists) {
        const fileStats = await fs.stat(filePath);
        this.logger.log(`[PRODUCTION DEBUG] File stats: size=${fileStats.size}, created=${fileStats.birthtime}`);
      }

      const result = this.getFileUrl(key, bucket);
      this.logger.log(`[PRODUCTION DEBUG] Generated URL: ${result.url}`);
      
      return result;
    } catch (error) {
      this.logger.error(`[PRODUCTION DEBUG] Upload failed: ${error.message}`, error.stack);
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
    const url = `${this.storageUrl}/${encodedKey}`;
    
    this.logger.debug(`[PRODUCTION DEBUG] getFileUrl - key: ${key}, encoded: ${encodedKey}, url: ${url}`);
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
    
    this.logger.debug(`[PRODUCTION DEBUG] getLocalPath - key: ${key}, bucket: ${bucket}, path: ${localPath}`);
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

  // Health check method for production debugging
  async getStorageHealth(): Promise<any> {
    try {
      const stats = await fs.stat(this.storagePath);
      const imageDirExists = await this.directoryExists(path.join(this.storagePath, 'Images'));
      const audioDirExists = await this.directoryExists(path.join(this.storagePath, 'Audio'));
      const userAudioDirExists = await this.directoryExists(path.join(this.storagePath, 'UserAudios'));
      const jsonDirExists = await this.directoryExists(path.join(this.storagePath, 'json'));

      // Get directory contents
      const contents = await fs.readdir(this.storagePath).catch(() => []);

      return {
        storagePath: this.storagePath,
        storageUrl: this.storageUrl,
        workingDirectory: process.cwd(),
        storageExists: true,
        storageStats: {
          isDirectory: stats.isDirectory(),
          size: stats.size,
          mode: stats.mode.toString(8),
          created: stats.birthtime,
          modified: stats.mtime,
        },
        directories: {
          Images: imageDirExists,
          Audio: audioDirExists,
          UserAudios: userAudioDirExists,
          json: jsonDirExists,
        },
        contents,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          LOCAL_STORAGE_PATH: this.configService.get<string>('LOCAL_STORAGE_PATH'),
          LOCAL_STORAGE_URL: this.configService.get<string>('LOCAL_STORAGE_URL'),
        }
      };
    } catch (error) {
      return {
        storagePath: this.storagePath,
        storageUrl: this.storageUrl,
        workingDirectory: process.cwd(),
        storageExists: false,
        error: error.message,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          LOCAL_STORAGE_PATH: this.configService.get<string>('LOCAL_STORAGE_PATH'),
          LOCAL_STORAGE_URL: this.configService.get<string>('LOCAL_STORAGE_URL'),
        }
      };
    }
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
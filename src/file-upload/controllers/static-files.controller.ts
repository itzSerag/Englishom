import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CurrentUser } from '../../auth/decorator/get-curr-user.decorator';
import { User } from 'src/user/models/user.schema';

@Controller('uploads')
export class StaticFilesController {
  private readonly logger = new Logger(StaticFilesController.name);
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = this.configService.get('LOCAL_STORAGE_PATH') || './uploads';
  }

  @Get('')
  async serveFile(
    @Param('0') filePath: string,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    try {
      // Decode the file path to handle encoded characters
      const decodedPath = decodeURIComponent(filePath);
      
      // Check for user-specific audio files and enforce ownership
      if (decodedPath.startsWith('UserAudios/')) {
        const pathParts = decodedPath.split('/');
        const userIdFromPath = pathParts[1];
        if (userIdFromPath !== user._id.toString()) {
          throw new ForbiddenException(
            'You do not have permission to access this file.',
          );
        }
      }

      // Sanitize the path to prevent directory traversal attacks
      const sanitizedPath = this.sanitizePath(decodedPath);
      const fullPath = path.join(this.storagePath, sanitizedPath);
      
      // Ensure the file is within the storage directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedStoragePath = path.resolve(this.storagePath);
      
      if (!resolvedPath.startsWith(resolvedStoragePath)) {
        this.logger.warn(`Attempted path traversal: ${decodedPath}`);
        throw new NotFoundException('File not found');
      }

      // Check if file exists and is accessible
      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          throw new NotFoundException('File not found');
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new NotFoundException('File not found');
        }
        throw error;
      }

      // Set appropriate headers based on file type
      const mimeType = this.getMimeType(path.extname(sanitizedPath));
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // For audio and images, allow cross-origin access
      if (mimeType.startsWith('audio/') || mimeType.startsWith('image/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Send the file
      res.sendFile(resolvedPath);
      
      this.logger.debug(`Served file: ${sanitizedPath}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Failed to serve file: ${filePath}`, error.stack);
      throw new NotFoundException('File not found');
    }
  }

  private sanitizePath(filePath: string): string {
    // Remove any leading slashes and normalize the path
    const normalized = path.normalize(filePath.replace(/^\/+/, ''));
    
    // Remove any remaining path traversal attempts
    const sanitized = normalized.replace(/\.\./g, '');
    
    return sanitized;
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  NotFoundException,
  Logger,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OptionalUser } from '../../auth/decorator/optional-user.decorator';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt.guard';
import { FileAccessService } from '../services/file-access.service';
import { User } from 'src/user/models/user.schema';
import { Admin } from 'src/admin/models/admin.schema';
import { Public } from '../../auth/decorator/public.decorator';

@Public() // Bypass global JWT guard
@UseGuards(OptionalJwtAuthGuard) // Use our optional guard instead
@Controller('uploads') // Change from empty path to 'uploads'
export class StaticFilesController {
  private readonly logger = new Logger(StaticFilesController.name);
  private readonly storagePath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly fileAccessService: FileAccessService,
  ) {
    const configuredPath = this.configService.get('LOCAL_STORAGE_PATH') || './uploads';
    // Convert relative path to absolute path to avoid working directory issues
    this.storagePath = path.isAbsolute(configuredPath) 
      ? configuredPath 
      : path.resolve(process.cwd(), configuredPath);
    this.logger.log(`Static files storage path resolved to: ${this.storagePath}`);
  }

  @Public() // Also apply to method level to ensure it works
  @Get('*path')
  async serveFile(
    @Param('path') filePath: string,
    @Req() req: Request,
    @Res() res: Response,
    @OptionalUser() user: User | Admin | null,
  ) {
    try {
      // Extract the file path from the request URL
      // Handle wildcard path parameter which might come as comma-separated string
      let extractedFilePath = '';
      
      if (filePath) {
        // If filePath has commas, it means the wildcard captured multiple path segments
        // Convert comma-separated segments back to path with forward slashes
        extractedFilePath = filePath.includes(',') 
          ? filePath.split(',').join('/') 
          : filePath;
      } else {
        // Fallback to extracting from request path
        extractedFilePath = req.path.replace(/^\/api\/uploads\//, '') || '';
      }
      
      this.logger.log(`Request path: ${req.path}`);
      this.logger.log(`Request URL: ${req.url}`);
      this.logger.log(`Named path parameter: ${filePath}`);
      this.logger.log(`Extracted filePath: ${extractedFilePath}`);
      this.logger.log(`Type of filePath: ${typeof extractedFilePath}`);
      
      // Validate that filePath is not undefined or empty
      if (!extractedFilePath || extractedFilePath.trim() === '') {
        this.logger.error('File path is undefined or empty');
        throw new NotFoundException('File path is required');
      }

      // Use file path directly since we're not encoding URLs anymore
      const decodedPath = extractedFilePath;
      
      this.logger.log(`File access request: ${decodedPath}`);
      
      // Determine file access type
      const accessType = this.fileAccessService.getFileAccessType(decodedPath);
      this.logger.debug(`File access type determined: ${accessType}`);
      
      // Handle access control based on file type
      if (accessType === 'user') {
        // User-specific files: require authentication and ownership
        if (!user) {
          throw new ForbiddenException('Authentication required to access this file.');
        }
        
        const pathParts = decodedPath.split('/');
        const userIdFromPath = pathParts[1];
        
        // Check if user owns the file or is admin
        const isAdmin = user.role === 'admin' && (user as Admin).adminRole;
        this.logger.debug(`Admin check - role: ${user.role}, adminRole: ${isAdmin ? (user as Admin).adminRole : 'none'}, userIdFromPath: ${userIdFromPath}, userId: ${user._id}`);
        
        if (!isAdmin && userIdFromPath !== user._id.toString()) {
          throw new ForbiddenException('You do not have permission to access this file.');
        }
      } else if (accessType === 'course') {
        // Course content: require course ownership or admin
        if (!user) {
          throw new ForbiddenException('Authentication required to access course content.');
        }
        
        const levelName = this.fileAccessService.extractLevelFromPath(decodedPath);
        if (!levelName) {
          throw new ForbiddenException('Invalid course content path.');
        }
        
        this.logger.debug(`Course access check - level: ${levelName}, user role: ${user.role}, admin role: ${user.role === 'admin' ? (user as Admin).adminRole : 'none'}`);
        
        const hasAccess = await this.fileAccessService.hasAccessToCourse(
          user._id.toString(),
          levelName,
          user.role,
          user.role === 'admin' ? (user as Admin).adminRole : undefined
        );
        
        if (!hasAccess) {
          throw new ForbiddenException(
            `You need to purchase the ${levelName.replace('LEVEL_', '')} course to access this content.`
          );
        }
      }
      // Public files: no authentication required

      // Sanitize the path to prevent directory traversal attacks
      const sanitizedPath = this.sanitizePath(decodedPath);
      const fullPath = path.join(this.storagePath, sanitizedPath);
      
      this.logger.log(`Sanitized path: ${sanitizedPath}`);
      this.logger.log(`Full path: ${fullPath}`);
      
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
          this.logger.error(`Path exists but is not a file: ${resolvedPath}`);
          throw new NotFoundException('File not found');
        }
        this.logger.log(`File found successfully: ${resolvedPath}, size: ${stats.size} bytes`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.error(`File not found at path: ${resolvedPath}`);
          throw new NotFoundException('File not found');
        }
        this.logger.error(`File stat error:`, error);
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
      
      this.logger.error(`Failed to serve file from request: ${req?.path || 'unknown'}`, error.stack);
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

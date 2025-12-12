import { Injectable, InternalServerErrorException, NotAcceptableException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadDTO, UploadJsonFileDTO } from './dto';
import { v4 as uuid } from 'uuid';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { UploadFileDTO } from './dto/get-content-aws';
import { FileUploadMessages } from '../common/shared/const';

enum FileType {
  IMAGE = 'Images',
  AUDIO = 'Audio',
}

interface JsonFile {
  data: any[];
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly bucket: GridFSBucket;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {
    // Initialize GridFS bucket (default bucket name 'uploads')
    this.bucket = new GridFSBucket(this.connection.db, {
      bucketName: 'appFiles',
    });
    // Force HTTPS for base URL
    const configUrl = this.configService.get<string>('BASE_URL')?.replace(/\/$/, '') || '';
    this.baseUrl = configUrl.replace(/^http:/, 'https:');
    this.logger.log(`FileUploadService initialized with baseUrl: ${this.baseUrl} (from config: ${configUrl})`);
    // Configure ffmpeg binary path if available
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  /**
   * Upload a single media file (image/audio) to GridFS and return a URL that streams it back.
   */
  async uploadSingleFile(
    file: Express.Multer.File,
    uploadJsonFileDTO: UploadFileDTO,
  ): Promise<{ url: string }> {
    this.validateFile(file);

    const fileTypePath = this.determineFileType(file.mimetype);
    const key = this.generateFileKey(
      fileTypePath,
      uploadJsonFileDTO,
      file.originalname.trim().replaceAll(/\s+/g, '_'),
    );

    // Predeclare temp files array for cleanup in finally
    let inputTempFiles: string[] = [];
    try {
      await this.uploadToGridFS(file, key);
      return { url: this.buildPublicUrl(key) };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload the user's daily audio file.
   */
  async uploadUserAudio(
    file: Express.Multer.File,
    uploadFileDTO: UploadFileDTO,
    userId: string,
  ): Promise<{ url: string }> {
    this.validateFile(file);
    const isWav = file.mimetype?.includes('wav') || file.originalname?.toLowerCase().endsWith('.wav');
    const ext = isWav ? 'wav' : 'mp3';
    const key = `UserAudios/${userId}/${uploadFileDTO.level_name}/${uploadFileDTO.day}/today_audio.${ext}`;
    try {
      await this.uploadToGridFS(file, key);
      return { url: this.buildPublicUrl(key) };
    } catch (error) {
      this.logger.error(`Failed to upload user audio: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload user audio: ${error.message}`);
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

  async getUserDayAudio(
    userId: string,
    levelName: string,
    day: string,
  ): Promise<{ url: string } | null> {
    // Try WAV first then MP3 for backward compatibility
    const wavKey = `UserAudios/${userId}/${levelName}/${day}/today_audio.wav`;
    const mp3Key = `UserAudios/${userId}/${levelName}/${day}/today_audio.mp3`;
    try {
      let file = await this.findFileByName(wavKey);
      let key = wavKey;
      if (!file) {
        file = await this.findFileByName(mp3Key);
        key = mp3Key;
      }
      if (!file) return null;
      return { url: this.buildPublicUrl(key) };
    } catch (error) {
      this.logger.error(`Error retrieving day audio: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to retrieve day audio: ${error.message}`);
    }
  }

  /**
   * Return combined level audio URL if present; otherwise null.
   */
  async getCombinedUserLevelAudio(
    userId: string,
    levelName: string,
    totalDays = 50,
  ): Promise<{ url: string } | null> {
    const combinedKey = `UserAudios/${userId}/${levelName}/combined/level_${levelName}_days_1-${totalDays}.wav`;
    try {
      const file = await this.findFileByName(combinedKey);
      if (!file) return null;
      return { url: this.buildPublicUrl(combinedKey) };
    } catch (error) {
      this.logger.error(`Failed to get combined audio: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to get combined audio: ${error.message}`);
    }
  }

  /**
   * Combine all day audios for a user across a given level range (1..50) into a single MP3.
   * Assumes daily audios stored at: UserAudios/<userId>/<levelName>/<day>/today_audio.mp3
   * Returns URL of combined file. If any day is missing, skips it (at least one required).
   */
 async combineUserLevelAudios(userId: string, levelName: string, totalDays = 50): Promise<{ url: string; combinedKey: string; daysCombined: number }> {
   
    if (!userId) throw new BadRequestException('userId required');
    if (!levelName) throw new BadRequestException('levelName required');

    const inputKeys: string[] = [];
    
    this.logger.log(`Starting to search for WAV files - userId: ${userId}, levelName: ${levelName}, totalDays: ${totalDays}`);
    
    // Only look for WAV files for consistency
    for (let day = 1; day <= totalDays; day++) {
      const wavKey = `UserAudios/${userId}/${levelName}/${day}/today_audio.wav`;
      this.logger.log(`Checking for file: ${wavKey}`);
      const wavFile = await this.findFileByName(wavKey);
      
      if (wavFile) {
        this.logger.log(`✓ Found: ${wavKey}`);
        inputKeys.push(wavKey);
      } else {
        this.logger.log(`✗ Not found: ${wavKey}`);
      }
    }
    
    if (inputKeys.length === 0) {
      throw new NotFoundException('No daily WAV audios found to combine');
    }
    
    this.logger.log(`==== SUMMARY: Found ${inputKeys.length} WAV files to combine ====`);
    this.logger.log('Files to combine:', JSON.stringify(inputKeys, null, 2));
    
    const combinedKey = `UserAudios/${userId}/${levelName}/combined/level_${levelName}_days_1-${totalDays}.wav`;


    let inputTempFiles: string[] = [];
    try {
      // Stream each GridFS file to a temp WAV to avoid high memory usage
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const tmpDir = os.tmpdir();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).slice(2);
      inputTempFiles = [];
      for (let i = 0; i < inputKeys.length; i++) {
        const key = inputKeys[i];
        const tempPath = path.join(tmpDir, `gfs_${timestamp}_${i}_${randomId}.wav`);
        this.logger.log(`Downloading ${key} -> ${tempPath}`);
        const fileDoc = await this.findFileByName(key);
        if (!fileDoc) throw new NotFoundException(`Missing audio: ${key}`);
        
        // Download file from GridFS
        await new Promise<void>((resolve, reject) => {
          const writeStream = fs.createWriteStream(tempPath);
          let hasData = false;
          
          this.bucket.openDownloadStream(fileDoc._id)
            .on('data', () => { hasData = true; })
            .on('error', (err) => {
              this.logger.error(`Failed to download ${key}: ${err.message}`);
              reject(new InternalServerErrorException(`File data missing for ${key}. The file may have been corrupted or chunks deleted.`));
            })
            .on('end', () => {
              if (!hasData) {
                reject(new InternalServerErrorException(`No data available for ${key}. File chunks may be missing.`));
              } else {
                resolve();
              }
            })
            .pipe(writeStream);
        });
        
        // Verify file was written
        if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
          throw new InternalServerErrorException(`Failed to download ${key} - file is empty or missing`);
        }
        
        inputTempFiles.push(tempPath);
      }
      
      this.logger.log(`Concatenating ${inputTempFiles.length} files via ffmpeg...`);
      const combinedBuffer = await this.concatenateAudioFiles(inputTempFiles);
      
      this.logger.log(`Combined buffer size: ${combinedBuffer.length} bytes`);
      this.logger.log(`Saving combined buffer to: ${combinedKey}`);
      await this.saveBufferToGridFS(combinedKey, combinedBuffer, 'audio/wav');
      
      this.logger.log(`Successfully combined ${inputKeys.length} audio files`);
      return { url: this.buildPublicUrl(combinedKey), combinedKey, daysCombined: inputKeys.length };
    } catch (error) {
      this.logger.error(`Failed combining user audios: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to combine audios: ${error.message}`);
    } finally {
      // Cleanup temp input files
      try {
        const fs = await import('fs');
        for (const f of inputTempFiles || []) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
      } catch {}
    }
  }

  /**
   * Concatenate multiple WAV buffers using ffmpeg concat demuxer.
   * Falls back to naive Buffer concatenation if ffmpeg binary not set (may produce invalid file).
   */
private async concatenateAudioFiles(inputFiles: string[]): Promise<Buffer> {
    if (inputFiles.length === 1) {
      const fs = await import('fs');
      return fs.readFileSync(inputFiles[0]);
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2);
    
    const listFilePath = path.join(tmpDir, `concat_${timestamp}_${randomId}.txt`);
    const outputPath = path.join(tmpDir, `combined_${timestamp}_${randomId}.wav`);
    
    try {
      const listContent = inputFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(listFilePath, listContent, 'utf8');
      const ffbin = ffmpegPath ? `"${ffmpegPath}"` : 'ffmpeg';
      const ffmpegCommand = [
        ffbin,
        '-f', 'concat',
        '-safe', '0',
        '-i', `"${listFilePath}"`,
        '-c:a', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '1',
        '-y',
        `"${outputPath}"`
      ].join(' ');
      await execAsync(ffmpegCommand, { timeout: 1000 * 60 * 2 });
      const combinedBuffer = fs.readFileSync(outputPath);
      return combinedBuffer;
    } catch (error) {
      this.logger.error(`FFmpeg concatenation failed: ${error.message}`);
      throw new Error(`Audio concatenation failed: ${error.message}`);
    } finally {
      try {
        const fs = await import('fs');
        if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temp files: ${cleanupError.message}`);
      }
    }
  }

  private async saveBufferToGridFS(key: string, buffer: Buffer, contentType: string): Promise<void> {
    // Delete existing if any
    const existing = await this.findFileByName(key);
    if (existing) {
      this.logger.log(`Deleting existing file: ${key}`);
      await this.bucket.delete(existing._id);
    }
    
    await new Promise<void>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(key, {
        contentType,
        metadata: { logicalKey: key },
      });
      uploadStream.on('error', (err) => reject(err));
      uploadStream.on('finish', () => resolve());
      uploadStream.write(buffer);
      uploadStream.end();
    });
    
    this.logger.log(`Saved buffer to GridFS: ${key}`);
  }

  async deleteUserAudio(userId: string, audioKey: string): Promise<void> {
    const key = audioKey.startsWith('UserAudios/') ? audioKey : `UserAudios/${audioKey}`;
    const file = await this.findFileByName(key);
    if (!file) throw new NotFoundException(`Audio file not found: ${key}`);
    try {
      await this.bucket.delete(file._id);
      this.logger.debug(`Successfully deleted audio file: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete audio file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete user audio: ${error.message}`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new NotAcceptableException('File is required');
    }
    const fileTypePath = this.determineFileType(file.mimetype);
    if (!fileTypePath) {
      throw new NotAcceptableException('Unsupported file type. Only images and audio files are allowed.');
    }
  }

  async insertIntoJsonDataArray(uploadFileDTO: UploadDTO): Promise<void> {
    const key = this.createJsonKey(uploadFileDTO);
    try {
      const jsonData = await this.getOrInitializeJsonData(key);
      for (const item of uploadFileDTO.data) {
        if (!item.id) item.id = uuid();
      }
      this.validateJsonDataArray(jsonData);
      jsonData.data.push(...uploadFileDTO.data);
      await this.saveJsonToGridFS(key, jsonData);
    } catch (error) {
      this.logger.error(`Failed to insert object into JSON data array: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to insert object into JSON data array: ${error.message}`);
    }
  }

  async deleteFromJsonDataArray(deleteObjDTO: DeleteObjDTO): Promise<void> {
    const { objectId, ...uploadDTO } = deleteObjDTO;
    const key = this.createJsonKey(uploadDTO);
    try {
      const jsonData = await this.getOrInitializeJsonData(key);
      const initialLength = jsonData.data.length;
      jsonData.data = jsonData.data.filter((item) => item.id !== objectId.toString());
      if (jsonData.data.length === initialLength) {
        throw new NotFoundException(`Object with ID ${objectId} not found`);
      }
      await this.saveJsonToGridFS(key, jsonData);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error('Error in deleteFromJsonDataArray:', error);
      throw new InternalServerErrorException(`Failed to delete object: ${error.message}`);
    }
  }

  async deleteFile(uploadFileDTO: UploadFileDTO) {
    const key = this.createJsonKey(uploadFileDTO);
    const file = await this.findFileByName(key);
    if (!file) return null;
    try {
      await this.bucket.delete(file._id);
      return { deleted: true };
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to delete file: ${error.message}`);
    }
  }

  async getContentByName(uploadFileDTO: UploadFileDTO) {
    const key = this.createJsonKey(uploadFileDTO);
    try {
      const jsonData = await this.getOrInitializeJsonData(key);
      return jsonData?.data ? jsonData : { data: [] };
    } catch (error) {
      this.logger.error(`Failed to get content by name: ${error.message}`, error.stack);
      return { data: [] };
    }
  }

  async getAudioBufferFromGridFS(key: string): Promise<Buffer> {
    const file = await this.findFileByName(key);
    if (!file) throw new NotFoundException('Audio file not found');
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      this.bucket.openDownloadStream(file._id)
        .on('data', (chunk) => chunks.push(chunk))
        .on('error', (err) => reject(err))
        .on('end', () => resolve(Buffer.concat(chunks)));
    });
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

  private async uploadToGridFS(file: Express.Multer.File, key: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(key, {
        contentType: file.mimetype,
        metadata: { logicalKey: key },
      });
      uploadStream.on('error', (err) => reject(err));
      uploadStream.on('finish', () => resolve());
      uploadStream.write(file.buffer);
      uploadStream.end();
    });
  }

  private async getOrInitializeJsonData(key: string): Promise<JsonFile> {
    try {
      const file = await this.findFileByName(key);
      if (!file) return { data: [] };
      const chunks: Buffer[] = [];
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        this.bucket.openDownloadStream(file._id)
          .on('data', (chunk) => chunks.push(chunk))
          .on('error', (err) => reject(err))
          .on('end', () => resolve(Buffer.concat(chunks)));
      });
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (!parsed.data) parsed.data = [];
      return parsed;
    } catch (error) {
      this.logger.warn(`Failed to retrieve JSON, initializing new. Key=${key} Error=${error.message}`);
      return { data: [] };
    }
  }

  private validateJsonDataArray(jsonData: JsonFile): void {
    if (!jsonData.data) {
      jsonData.data = [];
      return;
    }
    if (!Array.isArray(jsonData.data)) {
      throw new InternalServerErrorException('Invalid JSON structure: "data" is not an array');
    }
  }

  private async saveJsonToGridFS(key: string, data: JsonFile): Promise<void> {
    // Delete existing file if present to simplify overwrite semantics
    const existing = await this.findFileByName(key);
    if (existing) {
      await this.bucket.delete(existing._id);
    }
    const jsonBuffer = Buffer.from(JSON.stringify(data));
    await new Promise<void>((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(key, {
        contentType: 'application/json',
        metadata: { logicalKey: key },
      });
      uploadStream.on('error', (err) => reject(err));
      uploadStream.on('finish', () => resolve());
      uploadStream.write(jsonBuffer);
      uploadStream.end();
    });
  }

  private async listObjectsWithPrefix(prefix: string): Promise<{ url: string }[]> {
    const cursor = this.bucket.find({ filename: { $regex: `^${prefix}` } });
    const results: { url: string }[] = [];
    for await (const doc of cursor) {
      results.push({ url: this.buildPublicUrl(doc.filename) });
    }
    return results;
  }

  private async findFileByName(filename: string): Promise<{ _id: ObjectId; filename: string; length: number; metadata?: any; contentType?: string } | null> {
    // GridFS allows multiple versions with the same filename.
    // Always return the most recently uploaded version to avoid serving stale files.
    const files = await this.bucket
      .find({ filename })
      .sort({ uploadDate: -1 })
      .limit(1)
      .toArray();
    return (files[0] as any) || null;
  }

  private buildPublicUrl(key: string): string {
    // Frontend expects a direct URL; we expose a streaming endpoint /api/files/raw?key=<encodedKey>
    const encodedKey = encodeURIComponent(key);
    // Force HTTPS for resource URLs
    const secureBaseUrl = this.baseUrl.replace(/^http:/, 'https:');
    return `${secureBaseUrl}/api/files/raw?key=${encodedKey}`;
  }

  async streamFile(key: string, res: Response): Promise<void> {
    const file = await this.findFileByName(key);

    if (!file) throw new NotFoundException(FileUploadMessages.FILE_NOT_FOUND);
    const contentType = file.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // Derive original filename (last segment after '/')
    const originalName = key.split('/').pop() || 'file';
    // Prefer inline display for media & JSON, fallback to attachment for others
    const inlineTypes = ['image/', 'audio/', 'video/', 'application/json'];
    const dispositionType = inlineTypes.some((t) => contentType.startsWith(t))
      ? 'inline'
      : 'attachment';
      
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${originalName}"`
    );

    return await new Promise<void>((resolve, reject) => {
      this.bucket.openDownloadStream(file._id)
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .pipe(res);
    });
  }
}

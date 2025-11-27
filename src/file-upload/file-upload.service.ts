import { Injectable, InternalServerErrorException, NotAcceptableException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadDTO, UploadFileDTO } from './dto';
import { v4 as uuid } from 'uuid';
import { DeleteObjDTO } from './dto/delete-obj.dto';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

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
    this.baseUrl = this.configService.get<string>('BASE_URL')?.replace(/\/$/, '') || '';
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
   * Combine all day audios for a user across a given level range (1..50) into a single MP3.
   * Assumes daily audios stored at: UserAudios/<userId>/<levelName>/<day>/today_audio.mp3
   * Returns URL of combined file. If any day is missing, skips it (at least one required).
   */
  /**
   * Combine all day audios for a user across a given level range (1..50) into a single MP3.
   * Assumes daily audios stored at: UserAudios/<userId>/<levelName>/<day>/today_audio.mp3
   * Returns URL of combined file. If any day is missing, skips it (at least one required).
   */
  async combineUserLevelAudios(userId: string, levelName: string, totalDays = 50): Promise<{ url: string; combinedKey: string; daysCombined: number }> {
    if (!userId) throw new BadRequestException('userId required');
    if (!levelName) throw new BadRequestException('levelName required');

    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs');
    
    const tmpDir = os.tmpdir();
    const sessionId = uuid();
    const sessionDir = path.join(tmpDir, `audio_combine_${sessionId}`);
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir);
    }

    const inputFiles: string[] = [];
    
    try {
      this.logger.log(`Starting to search for WAV files - userId: ${userId}, levelName: ${levelName}, totalDays: ${totalDays}`);
      
      // Only look for WAV files for consistency
      for (let day = 1; day <= totalDays; day++) {
        const wavKey = `UserAudios/${userId}/${levelName}/${day}/today_audio.wav`;
        const fileExists = await this.findFileByName(wavKey);
        
        if (fileExists) {
          const tempFilePath = path.join(sessionDir, `day_${day}.wav`);
          this.logger.log(`Downloading: ${wavKey}`);
          await this.downloadFileToTemp(wavKey, tempFilePath);
          inputFiles.push(tempFilePath);
        }
      }
      
      if (inputFiles.length === 0) {
        throw new NotFoundException('No daily WAV audios found to combine');
      }
      
      this.logger.log(`==== SUMMARY: Found ${inputFiles.length} WAV files to combine ====`);
      
      const combinedKey = `UserAudios/${userId}/${levelName}/combined/level_${levelName}_days_1-${totalDays}.wav`;

      this.logger.log(`Concatenating ${inputFiles.length} audio files...`);
      const outputFilePath = await this.concatenateAudioFiles(inputFiles, sessionDir);
      
      this.logger.log(`Saving combined file to GridFS: ${combinedKey}`);
      await this.saveFileToGridFS(combinedKey, outputFilePath, 'audio/wav');
      
      this.logger.log(`Successfully combined ${inputFiles.length} audio files`);
      return { url: this.buildPublicUrl(combinedKey), combinedKey, daysCombined: inputFiles.length };
    } catch (error) {
      this.logger.error(`Failed combining user audios: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to combine audios: ${error.message}`);
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temp dir: ${cleanupError.message}`);
      }
    }
  }

  /**
   * Concatenate multiple WAV files using ffmpeg concat demuxer.
   */
  private async concatenateAudioFiles(inputFiles: string[], workDir: string): Promise<string> {
    if (inputFiles.length === 0) throw new Error('No files to concatenate');
    if (inputFiles.length === 1) return inputFiles[0];
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    const path = await import('path');
    
    const listFilePath = path.join(workDir, 'concat_list.txt');
    const outputPath = path.join(workDir, 'combined_output.wav');
    
    try {
      // Create concat list file
      const listContent = inputFiles.map(file => 
        `file '${file.replace(/\\/g, '/')}'`
      ).join('\n');
      fs.writeFileSync(listFilePath, listContent, 'utf8');
      
      this.logger.log(`Using FFmpeg to concatenate ${inputFiles.length} audio files...`);
      
      // Use FFmpeg with high-quality settings
      const ffmpegCommand = [
        'ffmpeg',
        '-f', 'concat',
        '-safe', '0',
        '-i', `"${listFilePath}"`,
        '-c:a', 'pcm_s16le',     // 16-bit PCM
        '-ar', '44100',          // 44.1kHz sample rate
        '-ac', '1',              // Mono
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', // Normalize loudness
        '-y',                    // Overwrite output
        `"${outputPath}"`
      ].join(' ');
      
      this.logger.log(`FFmpeg command: ${ffmpegCommand}`);
      
      const { stdout, stderr } = await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 10 });
      
      if (stderr) {
        this.logger.log(`FFmpeg output: ${stderr}`);
      }
      
      return outputPath;
      
    } catch (error) {
      this.logger.error(`FFmpeg concatenation failed: ${error.message}`);
      throw new Error(`Audio concatenation failed: ${error.message}`);
    }
  }

  private async downloadFileToTemp(key: string, filePath: string): Promise<void> {
    const file = await this.findFileByName(key);
    if (!file) throw new NotFoundException(`File not found: ${key}`);
    
    const fs = await import('fs');
    return new Promise((resolve, reject) => {
      const downloadStream = this.bucket.openDownloadStream(file._id);
      const writeStream = fs.createWriteStream(filePath);
      
      downloadStream.pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
        
      downloadStream.on('error', reject);
      writeStream.on('error', reject);
    });
  }

  private async saveFileToGridFS(key: string, filePath: string, contentType: string): Promise<void> {
    // Delete existing if any
    const existing = await this.findFileByName(key);
    if (existing) {
      this.logger.log(`Deleting existing file: ${key}`);
      await this.bucket.delete(existing._id);
    }
    
    const fs = await import('fs');
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      const uploadStream = this.bucket.openUploadStream(key, {
        contentType,
        metadata: { logicalKey: key },
      });
      
      readStream.pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
        
      readStream.on('error', reject);
      uploadStream.on('error', reject);
    });
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
    return `${this.baseUrl}/api/files/raw?key=${encodedKey}`;
  }

  async streamFile(key: string, res: Response): Promise<void> {
    const file = await this.findFileByName(key);
    if (!file) throw new NotFoundException('File not found');
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

    // Optional length header for client progress (if available)
    if (typeof file.length === 'number') {
      res.setHeader('Content-Length', file.length.toString());
    }

    return await new Promise<void>((resolve, reject) => {
      this.bucket.openDownloadStream(file._id)
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .pipe(res);
    });
  }
}

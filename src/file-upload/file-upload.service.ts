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
  async combineUserLevelAudios(userId: string, levelName: string, totalDays = 50): Promise<{ url: string; combinedKey: string; daysCombined: number }> {
    if (!userId) throw new BadRequestException('userId required');
    if (!levelName) throw new BadRequestException('levelName required');
    const inputKeys: string[] = [];
    for (let day = 1; day <= totalDays; day++) {
      const wavKey = `UserAudios/${userId}/${levelName}/${day}/today_audio.wav`;
      const mp3Key = `UserAudios/${userId}/${levelName}/${day}/today_audio.mp3`;
      const wavFile = await this.findFileByName(wavKey);
      if (wavFile) {
        inputKeys.push(wavKey);
        continue;
      }
      const mp3File = await this.findFileByName(mp3Key);
      if (mp3File) inputKeys.push(mp3Key);
    }
    if (inputKeys.length === 0) {
      throw new NotFoundException('No daily audios found to combine');
    }
  const combinedKey = `UserAudios/${userId}/${levelName}/combined/level_${levelName}_days_1-${totalDays}.wav`;

    // If already exists, return existing (idempotent)
    const existing = await this.findFileByName(combinedKey);
    if (existing) {
      return { url: this.buildPublicUrl(combinedKey), combinedKey, daysCombined: inputKeys.length };
    }

    try {
      const buffers: { key: string; buffer: Buffer }[] = [];
      for (const key of inputKeys) {
        const buffer = await this.getAudioBufferFromGridFS(key);
        buffers.push({ key, buffer });
      }
      const combinedBuffer = await this.concatenateAudioBuffers(buffers.map(b => b.buffer));
      await this.saveBufferToGridFS(combinedKey, combinedBuffer, 'audio/wav');
      return { url: this.buildPublicUrl(combinedKey), combinedKey, daysCombined: inputKeys.length };
    } catch (error) {
      this.logger.error(`Failed combining user audios: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to combine audios: ${error.message}`);
    }
  }

  /**
   * Concatenate multiple MP3 buffers using ffmpeg concat demuxer.
   * Falls back to naive Buffer concatenation if ffmpeg binary not set (may produce invalid file).
   */
  private async concatenateAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 1) return buffers[0];
    if (!ffmpegPath) {
      // Fallback simple concat
      this.logger.warn('ffmpeg-static not found, using naive buffer concatenation which may be invalid.');
      return Buffer.concat(buffers);
    }
    const tmp = await import('node:os');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const tmpDir = tmp.tmpdir();
    const listFilePath = path.join(tmpDir, `concat_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const partFiles: string[] = [];
    try {
      // Write each buffer to a temp file
      let idx = 0;
      for (const buf of buffers) {
        const partPath = path.join(tmpDir, `part_${Date.now()}_${idx}.wav`);
        fs.writeFileSync(partPath, buf);
        partFiles.push(partPath);
        idx++;
      }
      // Create concat list file using String.raw for clarity
      const listLines: string[] = [];
      for (const p of partFiles) {
        const sanitized = p.replaceAll("'", String.raw`'\''`);
        listLines.push(String.raw`file '${sanitized}'`);
      }
      fs.writeFileSync(listFilePath, listLines.join('\n'), 'utf-8');
      // Run ffmpeg concat
      const outputPath = path.join(tmpDir, `combined_${Date.now()}.wav`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listFilePath)
          .inputOptions(['-f concat', '-safe 0'])
          // Re-encode to WAV (PCM 16-bit) to ensure consistent output regardless of source codecs
          .outputOptions(['-c:a pcm_s16le'])
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
          .save(outputPath);
      });
      const outBuffer = fs.readFileSync(outputPath);
      return outBuffer;
    } finally {
      // Cleanup temp files
      try {
        const fs = await import('node:fs');
        if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
        for (const f of partFiles) if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (err) {
        this.logger.warn(`Temp file cleanup failed: ${err.message}`);
      }
    }
  }

  private async saveBufferToGridFS(key: string, buffer: Buffer, contentType: string): Promise<void> {
    // Delete existing if any
    const existing = await this.findFileByName(key);
    if (existing) await this.bucket.delete(existing._id);
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
    const files = await this.bucket.find({ filename }).toArray();
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

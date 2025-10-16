import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { FileUploadService } from '../file-upload.service';
import { compareTwoStrings } from 'string-similarity';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

@Injectable()
export class UserResultsService {
  private readonly logger = new Logger(UserResultsService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async compareSpeakTranscript(
    speakCompareTranscriptsDto: SpeakCompareTranscriptsDto,
    audioFile: Express.Multer.File
  ) {
    const { level_name, day, lesson_name, sentenceIndex } = speakCompareTranscriptsDto;

    // Validate audio file
    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    // 1. Fetch the lesson data based on level_name, day, and lesson
    const lessonData = await this.fileUploadService.getContentByName({
      level_name,
      day: day.toString(),
      lesson_name: lesson_name,
    });

    if (!lessonData?.data || lessonData.data.length === 0) {
      throw new NotFoundException('Lesson data not found');
    }

    // 2. Extract the sentences array from the lesson data
    const sentencesData = lessonData.data.find(item => item.sentences);

    if (!sentencesData || !Array.isArray(sentencesData.sentences) || sentencesData.sentences.length === 0) {
      throw new NotFoundException('No sentences found in lesson data');
    }

    // 3. Get the specific sentence the user is trying to speak
    if (sentenceIndex < 0 || sentenceIndex >= sentencesData.sentences.length) {
      throw new NotFoundException(
        `Sentence index ${sentenceIndex} is out of range. Sentence not available with this index.`
      );
    }

    const targetSentence = sentencesData.sentences[sentenceIndex]; // returns { sentence: string, soundSrc: string, ... }
    const correctSentence = targetSentence.sentence;

    const userTranscript : string = await this.transcribeAudio(audioFile);

    if (!userTranscript || userTranscript.trim().length === 0) {
      throw new BadRequestException('Could not transcribe audio. Please try again with clearer audio.');
    }

    // 5. Compare the correct sentence with the user's spoken transcript
    const similarityPercentage = this.calculateSimilarity(correctSentence, userTranscript);

    return {
      similarityPercentage,
      correctSentence,
      userTranscript,
      sentenceIndex,
      isPassed: similarityPercentage >= 70, // 70% threshold
    };
  }

  private calculateSimilarity(originalText: string, spokenText: string): number {
    // Normalize both texts
    const normalizeText = (text: string) => 
      text.toLowerCase().replaceAll(/[^\w\s]/g, '').trim().split(/\s+/).filter(word => word.length > 0);

    const originalWords = normalizeText(originalText);
    const spokenWords = normalizeText(spokenText);

    // Edge case 1: Empty original text
    if (originalWords.length === 0) return 0;

    // Edge case 2: User said nothing (empty recording)
    if (spokenWords.length === 0) return 0;

    const SIMILARITY_THRESHOLD = 0.8;
    let matches = 0;

    // Compare in order - word by word
    const minLength = Math.min(originalWords.length, spokenWords.length);
    
    for (let i = 0; i < minLength; i++) {
      const similarity = compareTwoStrings(originalWords[i], spokenWords[i]);
      if (similarity >= SIMILARITY_THRESHOLD) {
        matches++;
      }
    }

    // Edge case 3: User said MORE than the reference
    // Apply penalty for extra words (speaking too much)
    if (spokenWords.length > originalWords.length) {
      const extraWords = spokenWords.length - originalWords.length;
      const penalty = extraWords * 0.5; // Each extra word reduces score by 0.5 points
      matches = Math.max(0, matches - penalty); // Don't go below 0
    }

    // Calculate score based on original text length
    return Math.round((matches / originalWords.length) * 100);
  }

  // ---- STAGE_1: Transcribe audio using OpenAI Whisper ------------ //
  private async transcribeAudio(audioFile: Express.Multer.File): Promise<string> {
    try {
      this.logger.log(`Transcribing audio file: ${audioFile.originalname}`);

      this.validateAudioFileSize(audioFile);

      const file = await toFile(audioFile.buffer, audioFile.originalname);
      const text = await this.performTranscription(file, audioFile.size);

      this.logger.log(`Transcription successful`);
      return text.trim();
    } catch (error) {
      this.logger.error(`Transcription failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Validates that the audio file size is within acceptable limits
   */
  private validateAudioFileSize(audioFile: Express.Multer.File): void {
    const MAX_SIZE_BYTES = 20 * 1024 * 1024;
    if (audioFile.size && audioFile.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('Audio file is too large. Please upload a file under 20 MB.');
    }
  }

  /**
   * Performs the actual transcription with timeout and fallback logic
   */
  private async performTranscription(file: File, fileSize?: number): Promise<string> {
    const TIMEOUT_MS = 80_000;
    const preferredModel = this.configService.get<string>('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe';
    const language = this.configService.get<string>('OPENAI_TRANSCRIBE_LANGUAGE') || 'en';

    try {
      return await this.transcribeWithTimeout(file, preferredModel, language, fileSize, TIMEOUT_MS);
    } catch (err) {
      if (preferredModel !== 'whisper-1' && this.isModelNotFoundError(err)) {
        this.logger.warn(`Preferred model '${preferredModel}' not available. Falling back to 'whisper-1'.`);
        return await this.transcribeWithTimeout(file, 'whisper-1', language, fileSize, TIMEOUT_MS);
      }
      throw err;
    }
  }

  /**
   * Executes transcription with abort timeout
   */
  private async transcribeWithTimeout(
    file: File,
    model: string,
    language: string,
    fileSize: number | undefined,
    timeoutMs: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const apiStart = Date.now();
      const transcription = await this.openai.audio.transcriptions.create(
        { file, model, language, temperature: 0 },
        { signal: controller.signal }
      );

      const apiElapsed = Date.now() - apiStart;
      this.logger.log(`Transcription API (${model}) finished in ${apiElapsed} ms (size: ${fileSize ?? 'unknown'} bytes)`);

      const text: string = transcription?.text ?? '';
      if (!text) {
        throw new Error('Empty transcription result');
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Checks if an error indicates a model was not found
   */
  private isModelNotFoundError(err: any): boolean {
    return err?.status === 404 || /model(.+)?(not found|does not exist)/i.test(err?.message || '');
  }
}

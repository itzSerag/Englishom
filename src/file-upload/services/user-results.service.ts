import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { FileUploadService } from '../file-upload.service';
import { compareTwoStrings } from 'string-similarity';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import { WhisperNode } from 'whisper-node';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

@Injectable()
export class UserResultsService {
  private readonly logger = new Logger(UserResultsService.name);
  private readonly whisper: WhisperNode;

  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Whisper with configuration
    this.whisper = new WhisperNode({
      modelName: 'base.en', // Options: tiny.en, base.en, small.en, medium.en, large
      autoDownloadModelName: 'base.en',
      whisperOptions: {
        language: 'en',
        word_timestamps: false,
      },
    });
  }

  // Notice: This is for SPEAK type lessons, not READ lessons
  // User speaks a sentence and we compare it with the reference
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
        `Sentence index ${sentenceIndex} is out of range. Available: 0-${sentencesData.sentences.length - 1}`
      );
    }

    const targetSentence = sentencesData.sentences[sentenceIndex];
    const correctSentence = targetSentence.sentence;

    // 4. Transcribe the audio using Whisper
    const userTranscript = await this.transcribeAudio(audioFile.buffer);

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
      text.toLowerCase().replace(/[^\w\s]/g, '').trim().split(/\s+/).filter(word => word.length > 0);

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

  // ---- STAGE_1: Transcribe audio using Whisper ------------ //
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    let tempFilePath: string | null = null;

    try {
      // 1. Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        await mkdirAsync(tempDir, { recursive: true });
      }

      // 2. Write buffer to temporary file (Whisper needs a file path)
      tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);
      await writeFileAsync(tempFilePath, audioBuffer);

      // 3. Transcribe using whisper-node
      this.logger.log(`Transcribing audio file: ${tempFilePath}`);
      const output = await this.whisper.transcribe(tempFilePath);

      // 4. Extract text from output
      if (!output?.length) {
        throw new Error('No transcription output received');
      }

      // whisper-node returns array with text property
      const transcription = output.map(segment => segment.speech || '').join(' ').trim();

      if (!transcription) {
        throw new Error('Empty transcription result');
      }

      this.logger.log(`Transcription successful: ${transcription}`);
      return transcription;
    } catch (error) {
      this.logger.error(`Transcription failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to transcribe audio: ${error.message}`);
    } finally {
      // 5. Cleanup: Delete temporary file
      if (tempFilePath) {
        try {
          await unlinkAsync(tempFilePath);
          this.logger.log(`Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
          // Log but don't throw - main operation succeeded
          this.logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
        }
      }
    }
  }
}

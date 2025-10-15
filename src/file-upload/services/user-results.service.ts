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

    // 4. Transcribe the audio using OpenAI Whisper
    const userTranscript = await this.transcribeAudio(audioFile);

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

      // Basic size guard to avoid huge uploads that degrade performance
      const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB soft limit
      if (audioFile.size && audioFile.size > MAX_SIZE_BYTES) {
        throw new BadRequestException('Audio file is too large. Please upload a file under 20 MB.');
      }

      // Convert Buffer to a File-like using OpenAI helper (avoids extra copies and ensures filename)
      const file = await toFile(audioFile.buffer, audioFile.originalname);

      // Abort request if it takes too long (network stalls, etc.)
      const controller = new AbortController();
      const TIMEOUT_MS = 60_000; // 60s timeout; tune as needed
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      // Use a faster/cheaper transcribe model if available; fall back to whisper-1
      // Set language to speed up decoding when known (most lessons are English)
      const preferredModel = this.configService.get<string>('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe';
      const language = this.configService.get<string>('OPENAI_TRANSCRIBE_LANGUAGE') || 'en';

      const invokeTranscription = async (model: string) => {
        const apiStart = Date.now();
        const res = await this.openai.audio.transcriptions.create(
          {
            file,
            model,
            language,
            temperature: 0,
          },
          { signal: controller.signal }
        );
        const apiElapsed = Date.now() - apiStart;
        this.logger.log(`Transcription API (${model}) finished in ${apiElapsed} ms (size: ${audioFile.size ?? 'unknown'} bytes)`);
        return res;
      };

      const isModelNotFound = (err: any) =>
        err?.status === 404 || /model(.+)?(not found|does not exist)/i.test(err?.message || '');

      let transcription: any;
      try {
        transcription = await invokeTranscription(preferredModel);
      } catch (err) {
        if (preferredModel !== 'whisper-1' && isModelNotFound(err)) {
          this.logger.warn(`Preferred model '${preferredModel}' not available. Falling back to 'whisper-1'.`);
          clearTimeout(timeout);
          // Recreate controller for the second attempt
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackController.abort(), TIMEOUT_MS);
          try {
            transcription = await this.openai.audio.transcriptions.create(
              { file, model: 'whisper-1', language, temperature: 0 },
              { signal: fallbackController.signal }
            );
          } finally {
            clearTimeout(fallbackTimeout);
          }
        } else {
          throw err;
        }
      } finally {
        clearTimeout(timeout);
      }

  // Recent models return `text`; some experimental ones may return `output_text`
  const text: string = transcription?.text ?? transcription?.output_text ?? '';
      if (!text) {
        throw new Error('Empty transcription result');
      }

      this.logger.log(`Transcription successful`);      return text.trim();
    } catch (error) {
      this.logger.error(`Transcription failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to transcribe audio: ${error.message}`);
    }
  }
}

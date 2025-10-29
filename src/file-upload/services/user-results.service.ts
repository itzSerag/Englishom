import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { distance, closest } from 'fastest-levenshtein';
import { SpeakCompareTranscriptsDto } from '../dto/speak-compare-transcripts.dto';
import { TransformersAudioTranscribe } from '../../common/services/transformers-audio-transcribe.service';

@Injectable()
export class UserResultsService {
  private readonly logger = new Logger(UserResultsService.name);

  constructor(private readonly transformersAudioTranscribe: TransformersAudioTranscribe) {}

  async compareSpeakTranscript(
    speakCompareTranscriptsDto: SpeakCompareTranscriptsDto,
    audioFile: Express.Multer.File
  ) {
    const { sentenceText } = speakCompareTranscriptsDto;

    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    const correctSentence = (sentenceText ?? '').trim();
    if (!correctSentence) {
      throw new BadRequestException('sentenceText is required and must be non-empty');
    }

    const userTranscript = await this.transcribeAudio(audioFile);

    if (!userTranscript.trim()) {
      throw new BadRequestException('Could not transcribe audio. Please try again.');
    }

    const similarityPercentage = this.calculateSimilarity(correctSentence, userTranscript);

    return {
      similarityPercentage,
      correctSentence,
      userTranscript,
      isPassed: similarityPercentage >= 70,
    };
  }

  private calculateSimilarity(originalText: string, spokenText: string): number {
  try {
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .replaceAll(/[^\w\s]/g, '')
        .replaceAll(/\s+/g, ' ')
        .trim();
    };

    const normalizedOriginal = normalize(originalText);
    const normalizedSpoken = normalize(spokenText);

    if (!normalizedOriginal || !normalizedSpoken) return 0;

    // Method 1: Overall string similarity using fastest-levenshtein
    const dist = distance(normalizedOriginal, normalizedSpoken);
    const maxLen = Math.max(normalizedOriginal.length, normalizedSpoken.length);
    const overallSimilarity = 1 - (dist / maxLen);

    // Method 2: Word-by-word comparison
    const originalWords = normalizedOriginal.split(/\s+/);
    const spokenWords = normalizedSpoken.split(/\s+/);

    if (originalWords.length === 0) return 0;

    let wordMatches = 0;
    const DISTANCE_THRESHOLD = 2; // Allow up to 2 character differences

    for (const origWord of originalWords) {
      // Find closest match in spoken words
      const closestWord = closest(origWord, spokenWords);
      const wordDist = distance(origWord, closestWord);
      
      if (wordDist <= DISTANCE_THRESHOLD) {
        wordMatches++;
      }
    }

    const wordSimilarity = wordMatches / originalWords.length;

    // Length penalty
    const lengthPenalty = spokenWords.length > originalWords.length 
      ? Math.max(0, 1 - (spokenWords.length - originalWords.length) * 0.1)
      : 1;

    // Combine metrics
    const finalScore = (
      overallSimilarity * 0.4 +
      wordSimilarity * 0.6
    ) * lengthPenalty;

    return Math.round(finalScore * 100);

  } catch (error) {
    this.logger.error(`Similarity calculation error: ${error.message}`);
    return 0;
  }
}

  private async transcribeAudio(audioFile: Express.Multer.File): Promise<string> {
    this.validateAudioFileSize(audioFile);

    this.logger.log(`Transcribing: ${audioFile.originalname} (${(audioFile.size / 1024).toFixed(2)} KB)`);
    const text = await this.transformersAudioTranscribe.transcribeAudio(audioFile.buffer, {
      model: 'Xenova/whisper-tiny.en',
    });

    return text;
  }

  private validateAudioFileSize(audioFile: Express.Multer.File) {
    const MAX = 20 * 1024 * 1024;
    if (audioFile.size > MAX) {
      throw new BadRequestException('Audio file is too large (max 20 MB)');
    }
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { FileUploadService } from '../file-upload.service';
import { compareTwoStrings } from 'string-similarity';
import { log } from 'console';

@Injectable()
export class UserResultsService {
  constructor(private readonly fileUploadService : FileUploadService) {}


  // Notice: This is for SPEAK type lessons, not READ lessons
  // User speaks a sentence and we compare it with the reference
  async compareSpeakTranscript(speakCompareTranscriptsDto : SpeakCompareTranscriptsDto) {
    const {level_name, day, lesson_name, sentenceIndex, userTranscript } = speakCompareTranscriptsDto;

    // 1. Fetch the lesson data based on level_name, day, and lesson
    const lessonData  = await this.fileUploadService.getContentByName({
      level_name,
      day: day.toString(), // Convert number to string if necessary
      lesson_name: lesson_name,
    });

    if ( !lessonData?.data || lessonData.data.length === 0) {
      throw new NotFoundException('Lesson data not found');
    }

    // 2. Extract the sentences array from the lesson data
    const sentencesData = lessonData.data.find(item => item.sentences);
    
    if (!sentencesData || !Array.isArray(sentencesData.sentences) || sentencesData.sentences.length === 0) {
      throw new NotFoundException('No sentences found in lesson data');
    }

    log('Sentences Data:', sentencesData);

    // 3. Get the specific sentence the user is trying to speak
    if (sentenceIndex < 0 || sentenceIndex >= sentencesData.sentences.length) {
      throw new NotFoundException(`Sentence index ${sentenceIndex} is out of range. Available: 0-${sentencesData.sentences.length - 1}`);
    }

    const targetSentence = sentencesData.sentences[sentenceIndex];
    const correctSentence = targetSentence.sentence; // The reference sentence

    if (!userTranscript || userTranscript.trim().length === 0) {
      throw new NotFoundException('No user transcript provided');
    }

    // 4. Compare the correct sentence with the user's spoken transcript
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
}

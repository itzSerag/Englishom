import { Body, Controller, Post } from '@nestjs/common';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { UserResultsService } from '../services/user-results.service';

@Controller('/user-results')
export class UserResultsController {

    constructor(private readonly userResultService : UserResultsService) {}

  @Post('speak/compare-transcript')
  async compareSpeakTranscript(@Body() speakCompareTranscriptsDto : SpeakCompareTranscriptsDto) {

    const result = await this.userResultService.compareSpeakTranscript(speakCompareTranscriptsDto);

    return {
        message: 'Transcript comparison completed',
        ...result // includes: similarityPercentage, correctSentence, userTranscript, sentenceIndex, isPassed
    }
  }
}

import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { UserResultsService } from '../services/user-results.service';

@Controller('/user-results')
export class UserResultsController {

    constructor(private readonly userResultService : UserResultsService) {}

  @Post('speak/compare-transcript')
  @UseInterceptors(FileInterceptor('audio'))
  async compareSpeakTranscript(
    @Body() speakCompareTranscriptsDto : SpeakCompareTranscriptsDto,
    @UploadedFile() audioFile: Express.Multer.File
  ) {

    const result = await this.userResultService.compareSpeakTranscript(
      speakCompareTranscriptsDto,
      audioFile
    );

    return {
        message: 'Transcript comparison completed',
        ...result // includes: similarityPercentage, correctSentence, userTranscript, sentenceIndex, isPassed
    }
  }
}

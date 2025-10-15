import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeakCompareTranscriptsDto } from '../dto/read-compare-transcripts.dto';
import { UserResultsService } from '../services/user-results.service';
import { UserJwtGuard } from '../../user-auth/guards';
import { OrderRepo } from '../../payment/repo/order.repo';
import { User } from '../../user/models/user.schema';
import { CurrentUser } from '../../user-auth/decorator/get-curr-user.decorator';

@Controller('/user-results')
export class UserResultsController {

  constructor(
    private readonly userResultService : UserResultsService,
    private readonly orderRepo: OrderRepo, // Inject the OrderRepository
  ) {}


  @UseGuards(UserJwtGuard)
  @Post('speak/compare-transcript')
  @UseInterceptors(FileInterceptor('audio'))
  async compareSpeakTranscript(
    @Body() speakCompareTranscriptsDto : SpeakCompareTranscriptsDto,
    @CurrentUser() user: User,
    @UploadedFile() audioFile: Express.Multer.File,
  ) {

     // Check for existing completed order using transaction session
    const existingCompletedOrder = await this.orderRepo.findCompletedOrder(
      user._id.toString(),
      speakCompareTranscriptsDto.level_name,
    );

    if (!existingCompletedOrder) {
      throw new BadRequestException('User has not purchased this level');
    }
    
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

import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserJwtGuard } from '../../user-auth/guards';
import { OrderRepo } from '../../payment/repo/order.repo';
import { User } from '../../user/models/user.schema';
import { CurrentUser } from '../../user-auth/decorator/get-curr-user.decorator';
import { SpeakCompareTranscriptsDto } from '../dto/speak-compare-transcripts.dto';
import { UserResultsService } from '../services/user-results.service';

@Controller('/user-results')
export class UserResultsController {

  constructor(
    private readonly userResultService : UserResultsService,
    private readonly orderRepo: OrderRepo, // Inject the OrderRepository
  ) {}


  @UseGuards(UserJwtGuard)
  @Post('speak/compare-transcript')
  @UseInterceptors(FileInterceptor('audio', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB hard cap at request layer
    },
  }))
  async compareSpeakTranscript(
    @Body() speakCompareTranscriptsDto : SpeakCompareTranscriptsDto,
    @UploadedFile() audioFile: Express.Multer.File,
    @CurrentUser() user: User,
  ) {

  /////
  // NOTE: consider wrapping this into a reusable function and using it across the backend
    const existingCompletedOrder = await this.orderRepo.findCompletedOrder(
      user._id.toString(),
      speakCompareTranscriptsDto.level_name,
    );

    if (!existingCompletedOrder) {
      throw new BadRequestException('User has not purchased this level');
    }
    /////
    
    const result = await this.userResultService.compareSpeakTranscript(
      speakCompareTranscriptsDto,
      audioFile
    );

  return {
    ...result // includes: similarityPercentage, correctSentence, userTranscript, isPassed
  }
  }
}

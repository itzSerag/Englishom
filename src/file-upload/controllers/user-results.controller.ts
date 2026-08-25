import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserJwtGuard } from '../../user-auth/guards';
import { LevelAccessService } from '../../common/services/level-access.service';
import { User } from '../../user/models/user.schema';
import { CurrentUser } from '../../user-auth/decorator/get-curr-user.decorator';
import { SpeakCompareTranscriptsDto } from '../dto/speak-compare-transcripts.dto';
import { UserResultsService } from '../services/user-results.service';

@Controller('/user-results')
export class UserResultsController {
  constructor(
    private readonly userResultService: UserResultsService,
    private readonly levelAccessService: LevelAccessService,
  ) {}

  @UseGuards(UserJwtGuard)
  @Post('speak/compare-transcript')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB hard cap at request layer
      },
    }),
  )
  async compareSpeakTranscript(
    @Body() speakCompareTranscriptsDto: SpeakCompareTranscriptsDto,
    @UploadedFile() audioFile: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const accessInfo = await this.levelAccessService.getLatestAccessInfo(
      user._id.toString(),
      speakCompareTranscriptsDto.level_name,
    );

    if (!accessInfo || accessInfo.isExpired) {
      throw new BadRequestException(
        'User has not purchased this level or access has expired',
      );
    }

    const result = await this.userResultService.compareSpeakTranscript(
      speakCompareTranscriptsDto,
      audioFile,
    );

    return {
      ...result,
    };
  }
}

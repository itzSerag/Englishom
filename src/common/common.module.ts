import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { FrontendRedirectService } from './services/frontend-redirect.service';
import { TransformersAudioTranscribe } from './services/transformers-audio-transcribe.service';
import { LevelAccessService } from './services/level-access.service';
import { PaymentModule } from '../payment/paymob.module';
import { ClusterHelper } from './services/cluster-helper.service';

@Global() // Makes this module available everywhere without importing
@Module({
  imports: [PaymentModule],
  providers: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    ClusterHelper
    // Add other common services here
  ],
  exports: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    ClusterHelper
    // Export services you want to share
  ],
})
export class CommonModule {}

import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { FrontendRedirectService } from './services/frontend-redirect.service';
import { TransformersAudioTranscribe } from './services/transformers-audio-transcribe.service';
import { LevelAccessService } from './services/level-access.service';
import { PaymentModule } from '../payment/paymob.module';

@Global() // Makes this module available everywhere without importing
@Module({
  imports: [PaymentModule],
  providers: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    // Add other common services here
  ],
  exports: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    // Export services you want to share
  ],
})
export class CommonModule {}

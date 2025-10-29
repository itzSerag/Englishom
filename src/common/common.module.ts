import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { FrontendRedirectService } from './services/frontend-redirect.service';
import { TransformersAudioTranscribe } from './services/transformers-audio-transcribe.service';

@Global() // Makes this module available everywhere without importing
@Module({
  providers: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    // Add other common services here
  ],
  exports: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    // Export services you want to share
  ],
})
export class CommonModule {}

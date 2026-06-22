import { Module, Global, forwardRef } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { FrontendRedirectService } from './services/frontend-redirect.service';
import { TransformersAudioTranscribe } from './services/transformers-audio-transcribe.service';
import { LevelAccessService } from './services/level-access.service';
import { PaymentModule } from '../payment/paymob.module';
import { ClusterHelper } from './services/cluster-helper.service';
import { GlobalAuthenticationService } from './services/authentication.service';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';

@Global() // Makes this module available everywhere without importing
@Module({
  imports: [
    PaymentModule,
    forwardRef(() => UserModule),
    forwardRef(() => AdminModule),
  ],
  providers: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    ClusterHelper,
    GlobalAuthenticationService,
  ],
  exports: [
    IpService,
    FrontendRedirectService,
    TransformersAudioTranscribe,
    LevelAccessService,
    ClusterHelper,
    GlobalAuthenticationService,
  ],
})
export class CommonModule {}

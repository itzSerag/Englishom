import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { FrontendRedirectService } from './services/frontend-redirect.service';

@Global() // Makes this module available everywhere without importing
@Module({
  providers: [
    IpService,
    FrontendRedirectService,
    // Add other common services here
  ],
  exports: [
    IpService,
    FrontendRedirectService,
    // Export services you want to share
  ],
})
export class CommonModule {}

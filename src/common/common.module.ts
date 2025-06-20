import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';
import { TimeService } from './config/time.service';

@Global() // Makes this module available everywhere without importing
@Module({
  providers: [
    IpService,
    TimeService,
    // Add other common services here
  ],
  exports: [
    IpService,
    TimeService,
    // Export services you want to share
  ],
})
export class CommonModule {}

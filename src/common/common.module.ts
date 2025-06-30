import { Module, Global } from '@nestjs/common';
import { IpService } from './services/ip.service';

@Global() // Makes this module available everywhere without importing
@Module({
  providers: [
    IpService,
    // Add other common services here
  ],
  exports: [
    IpService,
    // Export services you want to share
  ],
})
export class CommonModule {}

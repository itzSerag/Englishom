import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FrontendRedirectService {
  private readonly logger = new Logger(FrontendRedirectService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get the default frontend URL from environment variables
   */
  private getDefaultFrontendUrl(): string {
    return (
      this.configService.getOrThrow<string>('FRONTEND_URL')
    );
  }

  /**
   * Get OAuth redirect URL - always use the configured frontend URL
   * OAuth providers don't send useful referer headers, so we must use env config
   */
  getOAuthRedirectUrl(): string {
    const frontendUrl = this.getDefaultFrontendUrl();
    const redirectUrl = `${frontendUrl}/auth/callback`;

    this.logger.debug(`OAuth redirect URL: ${redirectUrl}`);
    return redirectUrl;
  }

  /**
   * Get OAuth error redirect URL - always use the configured frontend URL
   */
  getOAuthErrorRedirectUrl(error: string, message: string): string {
    const frontendUrl = this.getDefaultFrontendUrl();
    const redirectUrl = `${frontendUrl}/auth/callback?error=${error}&message=${encodeURIComponent(message)}`;

    this.logger.debug(`OAuth error redirect URL: ${redirectUrl}`);
    return redirectUrl;
  }

  /**
   * Get payment success redirect URL (for emails) - defaults to user portal
   */
  getPaymentSuccessUrl(levelName: string): string {
    // Payments are always for users, so always use frontend URL from env
    const frontendUrl = this.getDefaultFrontendUrl();
    return `${frontendUrl}/courses/${levelName.toLowerCase()}`;
  }
}

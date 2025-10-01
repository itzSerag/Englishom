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
    return this.configService.get<string>('FRONTEND_URL') || 'https://serag-eldien.site';
  }

  /**
   * Get the frontend URL from referer header
   * Simply extracts the origin from the referer and redirects back there
   */
  private getFrontendOriginFromReferer(referer?: string): string {
    if (!referer) {
      // Default to frontend URL from env
      const defaultUrl = this.getDefaultFrontendUrl();
      this.logger.debug(`No referer, using default frontend URL: ${defaultUrl}`);
      return defaultUrl;
    }

    try {
      const url = new URL(referer);
      this.logger.debug(`Using referer origin: ${url.origin}`);
      return url.origin;
    } catch {
      // If referer is invalid, default to frontend URL from env
      const defaultUrl = this.getDefaultFrontendUrl();
      this.logger.debug(`Invalid referer, using default frontend URL: ${defaultUrl}`);
      return defaultUrl;
    }
  }

  /**
   * Get OAuth redirect URL - goes back to where the request came from
   */
  getOAuthRedirectUrl(referer?: string): string {
    const origin = this.getFrontendOriginFromReferer(referer);
    const redirectUrl = `${origin}/auth/callback`;
    
    this.logger.debug(`OAuth redirect URL: ${redirectUrl} (from referer: ${referer || 'none'})`);
    return redirectUrl;
  }

  /**
   * Get OAuth error redirect URL - goes back to where the request came from
   */
  getOAuthErrorRedirectUrl(error: string, message: string, referer?: string): string {
    const origin = this.getFrontendOriginFromReferer(referer);
    return `${origin}/auth/callback?error=${error}&message=${encodeURIComponent(message)}`;
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

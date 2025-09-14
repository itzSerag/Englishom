import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FrontendRedirectService {
  private readonly logger = new Logger(FrontendRedirectService.name);

  /**
   * Get the frontend URL from referer header
   * Simply extracts the origin from the referer and redirects back there
   */
  private getFrontendOriginFromReferer(referer?: string): string {
    if (!referer) {
      // Default to user portal if no referer
      return 'https://vite-tanstack-router.vercel.app';
    }

    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      // If referer is invalid, default to user portal
      return 'https://vite-tanstack-router.vercel.app';
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
    // Payments are always for users, so always use user portal
    return `https://vite-tanstack-router.vercel.app/courses/${levelName.toLowerCase()}`;
  }
}

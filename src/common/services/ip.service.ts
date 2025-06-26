import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'fast-geoip';

@Injectable()
export class IpService {
  private readonly logger = new Logger(IpService.name);

  /**
   * Get country from IP address
   * @param ip - IP address to lookup
   * @returns Country code (e.g., 'SA', 'US') or 'Unknown' if not found
   */
  async getCountryFromIp(ip: string): Promise<string> {
    try {
      // Handle localhost and private IPs
      if (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.') ||
        ip === 'localhost'
      ) {
        this.logger.debug(`Local/Private IP detected: ${ip}`);
        return 'Local';
      }

      // Use fast-geoip for country lookup
      const geo = await geoip.lookup(ip);
      const country = geo?.country || 'Unknown';

      this.logger.debug(`IP ${ip} resolved to country: ${country}`);
      return country;
    } catch (error) {
      this.logger.warn(`Failed to get country for IP ${ip}:`, error.message);
      return 'Unknown';
    }
  }

  /**
   * Extract real IP from request headers (handles proxies)
   * @param req - Express request object
   * @returns Real IP address
   */
  getRealIp(req: any): string {
    return (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    );
  }
}

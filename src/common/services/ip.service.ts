import { Injectable } from '@nestjs/common';
import * as geoip from 'geoip-lite';

@Injectable()
export class IpService {
  /**
   * Get country from IP address
   * @param ip - IP address to lookup
   * @returns Country code (e.g., 'SA', 'US') or 'Unknown' if not found
   */
  getCountryFromIp(ip: string): string {
    // this Handles the case where is Local or private IP
    try {
      // Handle localhost and private IPs
      if (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.')
      ) {
        return 'Local';
      }

      const geo = geoip.lookup(ip);
      return geo?.country || 'Unknown';
    } catch (error) {
      console.warn(`Failed to get country for IP ${ip}:`, error);
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

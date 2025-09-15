// Don't set global timezone in main.ts
// Instead, create a dedicated service

import { Injectable } from '@nestjs/common';
import * as moment from 'moment-timezone';

@Injectable()
export class TimeService {
  private readonly SAUDI_TZ = 'Asia/Riyadh';

  // Get current Saudi time
  now(): Date {
    return moment.tz(this.SAUDI_TZ).toDate();
  }

  // Simple method to replace new Date() calls - always returns KSA time
  createDate(): Date {
    return this.now();
  }

  // Convert any date to Saudi time
  // handle international users
  toSaudiTime(date: Date = new Date()): Date {
    return moment.tz(date, this.SAUDI_TZ).toDate();
  }

  // Format for display
  formatSaudi(date: Date = new Date()): string {
    return moment.tz(date, this.SAUDI_TZ).format('YYYY-MM-DD HH:mm:ss');
  }

  isActivityStale(lastActivityTime: Date, staleMinutes = 1): boolean {
    const currentTime = this.now();
    const staleThreshold = new Date(
      currentTime.getTime() - staleMinutes * 60000,
    );
    return lastActivityTime < staleThreshold;
  }
}

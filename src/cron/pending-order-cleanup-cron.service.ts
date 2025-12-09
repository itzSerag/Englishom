import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderRepo } from '../payment/repo/order.repo';
import { ClusterHelper } from '../common/services/cluster-helper.service';
import { PaymentStatus } from '../payment/types';

@Injectable()
export class PendingOrderCleanupCronService {
  private readonly logger = new Logger(PendingOrderCleanupCronService.name);

  constructor(
    private readonly orderRepo: OrderRepo,
    private readonly clusterHelper: ClusterHelper,
  ) {}

  /**
   * Runs every Sunday at 2 AM Riyadh time
   * Cleans up pending orders that are older than 24 hours
   */
  @Cron(CronExpression.EVERY_WEEK, {
    name: 'cleanup-pending-orders',
    timeZone: 'Asia/Riyadh',
  })
  async handlePendingOrderCleanup() {
    // Only run on primary instance to avoid duplicate processing
    if (!this.clusterHelper.isPrimary()) {
      this.logger.log('Skipping cleanup-pending-orders job on non-primary instance');
      return;
    }

    this.logger.log('Starting pending order cleanup job...');

    try {
      // Calculate cutoff date (24 hours ago)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Find and delete pending orders created more than 24 hours ago
      const deletedCount = await this.orderRepo.deletePendingOrdersOlderThan(oneDayAgo);

      this.logger.log(
        `Pending order cleanup completed: Removed ${deletedCount} orders older than 24 hours`,
      );
    } catch (error) {
      this.logger.error(
        `Error during pending order cleanup: ${error.message}`,
        error.stack,
      );
    }
  }
}

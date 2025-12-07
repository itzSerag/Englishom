import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderRepo } from '../payment/repo/order.repo';
import { ClusterHelper } from '../common/services/cluster-helper.service';

@Injectable()
export class OrderAccessCronService {
  private readonly logger = new Logger(OrderAccessCronService.name);

  constructor(
    private readonly orderRepo: OrderRepo,
    private readonly clusterHelper: ClusterHelper
  ) {}

  // Daily at 5 AM Riyadh to mark expired orders
  @Cron(CronExpression.EVERY_DAY_AT_5AM, { name: 'mark-expired-orders', timeZone: 'Asia/Riyadh' })
  async handleMarkExpiredOrders() {

    if (!this.clusterHelper.isPrimary()) {
      this.logger.log('Running mark-expired-orders job on primary instance');
      return
    }
    
    try {
      const now = new Date();
      const modified = await this.orderRepo.markExpiredOrdersCutoff(now);
      this.logger.log(`Order access expiry job: marked ${modified} orders as EXPIRED`);
    } catch (error) {
      this.logger.error(`Error marking expired orders: ${error.message}`);
    }
  }
}

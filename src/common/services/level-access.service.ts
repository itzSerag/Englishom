import { Injectable } from '@nestjs/common';
import { OrderRepo } from '../../payment/repo/order.repo';
import { Level_Name } from '../shared/enums';

export interface LevelAccessInfo {
  levelName: Level_Name | string;
  purchaseDate: Date;
  expiresAt: Date;
  daysElapsed: number;
  daysLeft: number;
  isExpired: boolean;
}

@Injectable()
export class LevelAccessService {
  private readonly ACCESS_DAYS = 60;

  constructor(private readonly orderRepo: OrderRepo) {}

  async getLatestAccessInfo(userId: string, levelName?: Level_Name): Promise<LevelAccessInfo | null> {
    const order = await this.orderRepo.findMostRecentOrder(userId, levelName);
    if (!order) return null;

    const purchaseDate = new Date(order.paymentDate || order.createdAt);
    const expiresAt = new Date(purchaseDate.getTime() + this.ACCESS_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysLeft = Math.max(0, this.ACCESS_DAYS - daysElapsed);
    const isExpired = daysLeft <= 0;

    return {
      levelName: order.levelName,
      purchaseDate,
      expiresAt,
      daysElapsed,
      daysLeft,
      isExpired,
    };
  }
}

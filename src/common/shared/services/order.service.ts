import { ClientSession } from 'mongoose';
import { Level_Name } from '../enums';

export abstract class OrderService {
  abstract findUserCompletedOrders(
    userId: string,
    session?: ClientSession,
  ): Promise<any[]>;

  abstract findCompletedOrder(
    userId: string,
    levelName: Level_Name,
    session?: ClientSession,
  ): Promise<any | null>;

  abstract findActiveCompletedOrder(
    userId: string,
    levelName: Level_Name,
    session?: ClientSession,
  ): Promise<any | null>;
}

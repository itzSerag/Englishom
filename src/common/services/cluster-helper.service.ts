// cluster.helper.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClusterHelper {
  private instanceId: string;
  
  constructor() {
    this.instanceId = process.env.NODE_APP_INSTANCE || 
                     process.env.INSTANCE_ID || 
                     '0';
  }
  
  isPrimary(): boolean {
    return this.instanceId === '0';
  }
  
  getInstanceId(): string {
    return this.instanceId;
  }
}
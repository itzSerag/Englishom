import { Injectable } from '@nestjs/common';
import { OrderRepo } from '../../payment/repo/order.repo';
import { Level_Name } from '../../common/shared/enums';
import { AdminRole } from '../../common/shared';

@Injectable()
export class FileAccessService {
  constructor(private readonly orderRepo: OrderRepo) {}

  /**
   * Check if user has access to course-specific files
   */
  async hasAccessToCourse(
    userId: string, 
    levelName: Level_Name, 
    userRole?: string,
    adminRole?: AdminRole
  ): Promise<boolean> {
    // Allow all admins to access any file
    if (userRole === 'admin' || adminRole) {
      return true;
    }

    // Check if user has completed order for this course
    const completedOrder = await this.orderRepo.findCompletedOrder(userId, levelName);
    return !!completedOrder;
  }

  /**
   * Extract level name from file path
   */
  extractLevelFromPath(filePath: string): Level_Name | null {
    // Match pattern: Images/LEVEL_XX/ or Audio/LEVEL_XX/
    const match = filePath.match(/^(?:Images|Audio)\/LEVEL_([A-Z0-9]+)\//);
    if (!match) return null;

    const levelName = `LEVEL_${match[1]}` as Level_Name;
    // Validate it's a real level
    const validLevels = Object.values(Level_Name);
    return validLevels.includes(levelName) ? levelName : null;
  }

  /**
   * Determine file type and access rules
   */
  getFileAccessType(filePath: string): 'public' | 'course' | 'user' {
    if (filePath.startsWith('Public/')) {
      return 'public';
    }
    
    if (filePath.startsWith('UserAudios/')) {
      return 'user';
    }
    
    if (filePath.startsWith('Images/') || filePath.startsWith('Audio/')) {
      return 'course';
    }
    
    // Default to public for any other files (backwards compatibility)
    return 'public';
  }
}

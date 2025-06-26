import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AbstractRepo } from '../../common/database/repo/abstract.repo';
import { User } from '../models/user.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Level_Name } from '../../common/shared/enums';
import { UserProgress } from '../models/user-progress.schema';
import { Day } from '../models/day.schema';
import { Task } from '../models/task.schema';
import { UserTask } from '../models/user-task.schema';
import { toObjectId } from '../../common/utils/mongoose.utils';

@Injectable()
export class UserRepo extends AbstractRepo<User> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(UserProgress.name)
    private readonly userProgressModel: Model<UserProgress>,
    @InjectModel(Day.name) private readonly dayModel: Model<Day>,
    @InjectModel(Task.name) private readonly taskModel: Model<any>,
    @InjectModel(UserTask.name) private readonly userTaskModel: Model<any>,
  ) {
    super(userModel);
  }

  async userProgress(
    userId: string,
    levelName: Level_Name,
  ): Promise<number | null> {
    try {
      // Convert userId to ObjectId
      const userIdObjectId = toObjectId(userId);

      const completedProgress = await this.userProgressModel
        .find({
          userId: userIdObjectId,
          completed: true,
        })
        .populate({
          path: 'dayId',
          match: { levelName }, // filter by levelName
          select: 'dayNumber levelName',
        })
        .select('dayId') // only get day info
        .lean();

      const completedDayNumbers = completedProgress
        .filter((p) => p.dayId) // make sure populate didn't miss
        .map((p) => p.dayId.dayNumber);

      // Return the maximum day number or null if no days are completed
      return completedDayNumbers.length > 0
        ? Math.max(...completedDayNumbers)
        : 0;
    } catch (error) {
      if (error instanceof ForbiddenException) throw new Error(error.message);

      this.logger.error(
        `Error getting completed days: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get completed days');
    }
  }

  async markDayAsCompleted(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
  ) {
    const day = await this.getOrCreateDay(levelName, dayNumber);

    try {
      // Convert userId to ObjectId
      const userIdObjectId = toObjectId(userId);

      await this.userProgressModel.updateOne(
        {
          userId: userIdObjectId,
          dayId: day._id,
        },
        {
          $set: {
            completed: true,
            completedAt: new Date(),
          },
        },
        { upsert: true },
      );

      return { message: 'Day marked as completed successfully' };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Error marking day as completed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to mark day as completed');
    }
  }

  async markTaskAsCompleted(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
    taskName: string,
  ) {
    try {
      // Convert userId to ObjectId
      const userIdObjectId = toObjectId(userId);

      const day = await this.getOrCreateDay(levelName, dayNumber);

      // Step 3: Get or create the Task (upsert style)
      const task = await this.taskModel.findOneAndUpdate(
        { dayId: day._id, name: taskName },
        {
          $setOnInsert: {
            description: 'Task Default Description',
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      // Step 4: Update or create UserTask
      await this.userTaskModel.updateOne(
        {
          userId: userIdObjectId,
          taskId: task._id,
        },
        {
          $set: {
            completed: true,
            completedAt: new Date(),
          },
        },
        { upsert: true },
      );

      return { message: 'Task marked as completed successfully' };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Error marking task as completed: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to mark task as completed',
      );
    }
  }

  async getCompletedTasksInDay(
    userId: string,
    levelName: Level_Name,
    dayNumber: number,
  ) {
    try {
      // Convert userId to ObjectId
      const userIdObjectId = toObjectId(userId);

      const day = await this.dayModel.findOne({ levelName, dayNumber });
      if (!day) {
        return [];
      }

      const completedTasks = await this.userTaskModel
        .find({
          userId: userIdObjectId,
          completed: true,
        })
        .populate({
          path: 'taskId',
          match: { dayId: day._id },
          select: 'name description',
        })
        .select('taskId')
        .lean();

      return completedTasks
        .filter((t) => t.taskId) // make sure populate didn't miss
        .map((t) => t.taskId.name);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error(
        `Error getting completed tasks: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to get completed tasks');
    }
  }

  private async getOrCreateDay(
    levelName: Level_Name,
    dayNumber: number,
  ): Promise<Day> {
    // Find or create the Day
    const day = await this.dayModel.findOneAndUpdate(
      { levelName, dayNumber },
      {
        $setOnInsert: {
          levelName,
          dayNumber,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    return day;
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    try {
      // Convert filter _id to ObjectId if it's a string
      if (filter._id && typeof filter._id === 'string') {
        filter._id = toObjectId(filter._id);
      }

      return await this.userModel.countDocuments(filter).exec();
    } catch (error) {
      this.logger.error(
        `Error counting documents: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to count documents');
    }
  }
}

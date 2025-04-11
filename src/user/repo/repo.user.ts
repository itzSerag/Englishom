import { ForbiddenException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { AbstractRepo } from "src/common/database/repo/abstract.repo";
import { User } from "../models/user.schema";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { Level_Name } from "src/common/shared/enums";
import { UserProgress } from "../models/user-progress.schema";
import { Day } from "../models/day.schema";
import { Task } from "../models/task.schema";
import { UserTask } from "../models/user-task.schema";


@Injectable()
export class UserRepo extends AbstractRepo<User> {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(UserProgress.name) private readonly userProgressModel: Model<UserProgress>,
        @InjectModel(Day.name) private readonly dayModel: Model<Day>,
        @InjectModel(Task.name) private readonly taskModel: Model<any>,
        @InjectModel(UserTask.name) private readonly userTaskModel: Model<any>,
    ) {
        super(userModel);
    }

    async userProgress(userId: string, levelName: Level_Name) {

        try {

            const completedProgress = await this.userProgressModel.find({
                userId,
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
                .filter(p => p.dayId) // make sure populate didn’t miss
                .map(p => p.dayId.dayNumber);

            return completedDayNumbers;

        } catch (error) {
            if (error instanceof ForbiddenException) throw new Error(error.message);

            this.logger.error(`Error getting completed days: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to get completed days');
        }

    }

    async markDayAsCompleted(userId: string, levelName: Level_Name, dayNumber: number) {

        const day = await this.getOrCreateDay(levelName, dayNumber);

        try {

            await this.userProgressModel.updateOne(
                {
                    userId,
                    dayId: day._id,
                },
                {
                    $set: {
                        completed: true,
                        completedAt: new Date(),
                    },
                },
                { upsert: true }
            );

            return { message: 'Day marked as completed successfully' };

        } catch (error) {
            if (error instanceof ForbiddenException) throw error;

            this.logger.error(`Error marking day as completed: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to mark day as completed');
        }

    }

    async markTaskAsCompleted(userId: string, levelName: Level_Name, dayNumber: number, taskName: string) {
        try {

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
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );

            await this.userTaskModel.updateOne(
                { userId, taskId: task._id },
                {
                    $set: {
                        completed: true,
                        completedAt: new Date(),
                    },
                },
                { upsert: true }
            );

            return { message: 'Task completed successfully' };
        } catch (error) {
            if (error instanceof ForbiddenException) throw error;

            this.logger.error(`Error marking task as completed: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to mark task as completed');
        }
    }


    async getCompletedTasksInDay(userId: string, levelName: Level_Name, dayNumber: number) {
        try {

            const day = await this.dayModel.findOne({ levelName, dayNumber });

            if (!day) return [];

            const completedTasks = await this.userTaskModel
                .find({ userId, completed: true })
                .populate({
                    path: 'taskId',
                    match: { dayId: day._id },
                    select: 'name', // only return task name
                });

            const taskNames = completedTasks
                .filter(entry => entry.taskId) 
                .map(entry => entry.taskId.name);

            return taskNames;
        } catch (error) {
            if (error instanceof ForbiddenException) throw error;

            this.logger.error(`Error getting completed tasks: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to get completed tasks');
        }
    }



    private async getOrCreateDay(levelName: Level_Name, dayNumber: number): Promise<Day> {
        let day = await this.dayModel.findOne({ levelName, dayNumber });

        if (!day) {
            day = await this.dayModel.create({ levelName, dayNumber });
        }

        return day;
    }

}
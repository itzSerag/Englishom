// filepath: /mnt/DATA/Englishom/src/user/user.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepo } from './repo/repo.user';
import { DatabaseModule } from '../common/database/database.module';
import { User, UserSchema } from './models/user.schema';
import { PaymentModule } from '../payment/paymob.module';
import { AuthModule } from '../auth/auth.module';
import { Day, DaySchema } from './models/day.schema';
import { Task, TaskSchema } from './models/task.schema';
import {
  UserProgress,
  UserProgressSchema,
} from './models/user-progress.schema';
import { UserTask, UserTaskSchema } from './models/user-task.schema';
import { Level, LevelSchema } from './models/level.schema';

// filepath: /mnt/DATA/Englishom/src/user/user.module.ts
@Module({
  imports: [
    DatabaseModule,
    DatabaseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProgress.name, schema: UserProgressSchema },
      { name: Day.name, schema: DaySchema },
      { name: Task.name, schema: TaskSchema },
      { name: UserTask.name, schema: UserTaskSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Level.name, schema: LevelSchema },
    ]),
    forwardRef(() => PaymentModule), // Use forwardRef here
    forwardRef(() => AuthModule), // Use forwardRef here
  ],
  controllers: [UserController],
  providers: [UserService, UserRepo],
  exports: [UserService, UserRepo], // Export UserService
})
export class UserModule {}

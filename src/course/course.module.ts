import { Module, forwardRef } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseRepo } from './repo/course.repo';
import { DatabaseModule } from '../common/database/database.module';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { Course, CourseSchema } from './models/course.schema';

@Module({
  imports: [
    DatabaseModule.forFeature([{ name: Course.name, schema: CourseSchema }]),
    forwardRef(() => AdminAuthModule), // For admin guards
  ],
  controllers: [CourseController],
  providers: [CourseService, CourseRepo],
  exports: [CourseService, CourseRepo],
})
export class CourseModule {}

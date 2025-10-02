import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CourseService } from './course.service';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AdminRole, Level_Name } from '../common/shared/enums';
import { Public } from '../user-auth/decorator/public.decorator';
import { AdminRoles } from '../admin-auth/decorators';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  // JUST remainder -- we can delete this await in the cruds
  // NestJS already understands that the controller methods are async

  // and will handle the promise resolution for me.
  @Get()
  @Public()
  async findAll() {
    const courses = await this.courseService.findAll();
    return courses;
  }

  @Get(':level_name')
  @Public()
  async findByLevelName(@Param('level_name') level_name: Level_Name) {
    const course = await this.courseService.findByLevelName(level_name);
    return course;
  }

  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER, AdminRole.OPERATOR)
  @Patch('admin')
  async update(
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    const course = await this.courseService.update(updateCourseDto);
    return course;
  }
}

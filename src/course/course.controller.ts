import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CourseService } from './course.service';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AdminRole, Level_Name } from '../common/shared/enums';
import { Public } from '../common/decorators/public.decorator';
import { AdminRoles } from '../admin-auth/decorators';
import { AdminJwtGuard, AdminRoleGuard } from '../admin-auth/guards';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Public()
  @Get()
  async findAll() {
    const courses = await this.courseService.findAllCourses();
    return courses;
  }

  @Public()
  @Get(':level_name')
  async findByLevelName(@Param('level_name') level_name: Level_Name) {
    const course = await this.courseService.findByLevelName(level_name);
    return course;
  }

  // Only SUPER, MANAGER, and OPERATOR admins can update courses
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER, AdminRole.OPERATOR)
  @UseGuards(AdminJwtGuard, AdminRoleGuard)
  @Patch('admin')
  async update(@Body() updateCourseDto: UpdateCourseDto) {
    const course = await this.courseService.updateCourse(updateCourseDto);
    return course;
  }
}

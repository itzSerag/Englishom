import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CourseService } from './course.service';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AdminRole, Level_Name } from '../common/shared/enums';
import { Public } from '../user-auth/decorator/public.decorator';
import { AdminRoles } from '../admin/decorators';
import { IsAdminGuard, AdminRoleGuard } from '../admin-auth/guards';

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
  @Patch('admin/:level_name')
  async update(
    @Param('level_name') level_name: Level_Name,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    const course = await this.courseService.update(level_name, updateCourseDto);
    return course;
  }
}

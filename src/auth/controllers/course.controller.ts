import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { AdminRole, Level_Name } from 'src/common/shared/enums';
import { Roles } from '../decorator/roles.decorator';
import { Public } from '../decorator/public.decorator';
import { cleanSensitiveFields, cleanSensitiveFieldsArray } from '../../common/utils/response.utils';
import { AdminRoles } from 'src/admin/decorators';
import { Admin } from 'src/admin/models/admin.schema';

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
  async findByLevelName(
    @Param('level_name') level_name: Level_Name,
  ) {
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

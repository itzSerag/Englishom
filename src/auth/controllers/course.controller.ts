import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Level_Name } from 'src/common/shared/enums';
import { Roles } from '../decorator/roles.decorator';
import { Public } from '../decorator/public.decorator';
import { AdminGuard } from '../guards/admin.guard';
import { cleanSensitiveFields, cleanSensitiveFieldsArray } from '../../common/utils/response.utils';

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
    return cleanSensitiveFieldsArray(courses);
  }

  @Get(':level_name')
  @Public()
  async findByLevelName(
    @Param('level_name') level_name: Level_Name,
  ) {
    const course = await this.courseService.findByLevelName(level_name);
    return cleanSensitiveFields(course);
  }

  @Patch('admin/:level_name')
  @UseGuards(AdminGuard)
  async update(
    @Param('level_name') level_name: Level_Name,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    const course = await this.courseService.update(level_name, updateCourseDto);
    return cleanSensitiveFields(course);
  }
}

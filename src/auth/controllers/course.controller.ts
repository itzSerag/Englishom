import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Level_Name } from 'src/common/shared/enums';
import { Roles } from '../decorator/roles.decorator';
import { Role } from 'src/common/shared';
import { CourseDto } from '../dto/course.dto';
import { plainToInstance } from 'class-transformer';
import { Public } from '../decorator/public.decorator';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  // JUST remainder -- we can delete this await in the cruds
  // NestJS already understands that the controller methods are async

  // and will handle the promise resolution for me.
  @Get()
  @Public()
  async findAll(): Promise<CourseDto[]> {
    const courses = await this.courseService.findAll();
    return plainToInstance(CourseDto, courses, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':level_name')
  @Public()
  async findByLevelName(
    @Param('level_name') level_name: Level_Name,
  ): Promise<CourseDto> {
    const course = await this.courseService.findByLevelName(level_name);

    // return its DTO
    return plainToInstance(CourseDto, course, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('admin/:level_name')
  @Roles(Role.ADMIN)
  async update(
    @Param('level_name') level_name: Level_Name,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<CourseDto> {
    const course = await this.courseService.update(level_name, updateCourseDto);
    return plainToInstance(CourseDto, course, {
      excludeExtraneousValues: true,
    });
  }
}

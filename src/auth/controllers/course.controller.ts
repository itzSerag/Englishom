import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CourseService } from '../services/course.service';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { Level_Name } from 'src/common/shared/enums';
import { Course } from '../models/admin-course';
import { Roles } from '../decorator/roles.decorator';
import { Role } from 'src/common/shared';

@Roles(Role.ADMIN)
@Controller('admin/courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) { }

  // JUST remainder -- we can delete this await in the cruds
  // NestJS already understands that the controller methods are async
  // and will handle the promise resolution for me.

  @Get()
  async findAll(): Promise<Course[]> {
    return await this.courseService.findAll();
  }

  @Get(':level_name')
  async findByLevelName(@Param('level_name') level_name: Level_Name): Promise<Course> {
    return await this.courseService.findByLevelName(level_name);
  }

  @Post()
  async create(@Body() createCourseDto: CreateCourseDto): Promise<Course> {
    return await this.courseService.create(createCourseDto);
  }

  @Patch(':level_name')
  async update(
    @Param('level_name') level_name: Level_Name,
    @Body() updateCourseDto: UpdateCourseDto,
  ): Promise<Course> {
    return await this.courseService.update(level_name, updateCourseDto);
  }

  @Delete(':level_name')
  async delete(@Param('level_name') level_name: Level_Name): Promise<Course> {
    return await this.courseService.delete(level_name);
  }
} 
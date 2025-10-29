import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseRepo } from './repo/course.repo';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Level_Name } from 'src/common/shared/enums';
import { Course } from './models/course.schema';

@Injectable()
export class CourseService {
  constructor(private readonly courseRepo: CourseRepo) {}

  async findAllCourses(): Promise<Course[]> {
    return await this.courseRepo.find({});
  }

  async findByLevelName(level_name: Level_Name): Promise<Course> {
    const course = await this.courseRepo.findByLevelName(level_name);
    if (!course) {
      throw new NotFoundException(
        `Course with level name ${level_name} not found`,
      );
    }
    return course;
  }

  async createCourse(createCourseDto: CreateCourseDto): Promise<Course> {
    return this.courseRepo.create(createCourseDto);
  }

  async updateCourse(updateCourseDto: UpdateCourseDto): Promise<Course> {
    const updatedCourse = await this.courseRepo.findOneAndUpdate(
      { level_name: updateCourseDto.level_name },
      updateCourseDto,
    );
    
    if (!updatedCourse) {
      throw new NotFoundException(
        `Course with level name ${updateCourseDto.level_name} not found`,
      );
    }
    return updatedCourse;
  }
}

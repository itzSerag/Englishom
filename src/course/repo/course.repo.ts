import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from '../models/course.schema';
import { Level_Name } from 'src/common/shared/enums';
import { AbstractRepo } from '../../common/database/repo/abstract.repo';

@Injectable()
export class CourseRepo extends AbstractRepo<Course> {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<Course>,
  ) {
    super(courseModel);
  }

  // async findAll(): Promise<Course[]> {
  //   return await this.courseModel.find().exec();
  // }

  async findByLevelName(level_name: Level_Name): Promise<Course> {
    return await this.courseModel.findOne({ level_name }).lean();
  }

  // async create(createCourseDto: CreateCourseDto): Promise<Course> {
  //   const newCourse = new this.courseModel(createCourseDto);
  //   return await newCourse.save();
  // }

  // async update(level_name: Level_Name, updateCourseDto: UpdateCourseDto): Promise<Course> {
  //   return await this.courseModel.findOneAndUpdate(
  //     { level_name },
  //     updateCourseDto,
  //     { new: true }
  //   ).exec();
  // }

  // async delete(level_name: Level_Name): Promise<Course> {
  //   return await this.courseModel.findOneAndDelete({ level_name }).exec();
  // }
}

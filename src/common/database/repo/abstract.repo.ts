import { Injectable, Logger } from '@nestjs/common';
import {
  ClientSession,
  FilterQuery,
  Model,
  Types,
  UpdateQuery,
} from 'mongoose';
import { AbstractDocument } from '../abstract.schema';
import { convertFilterToObjectId } from '../../utils/mongoose.utils';

@Injectable()
export abstract class AbstractRepo<TSchema extends AbstractDocument> {
  protected readonly logger = new Logger(AbstractRepo.name);

  constructor(private readonly model: Model<TSchema>) {}

  async create(
    document: Partial<TSchema>,
    session?: ClientSession,
  ): Promise<TSchema> {
    const created = new this.model({
      ...document,
      _id: new Types.ObjectId(),
    });

    return (
      await created.save({ session: session || null })
    ).toJSON() as TSchema;
  }

  async findOne(
    filterQuery: FilterQuery<TSchema>,
    session?: ClientSession,
  ): Promise<TSchema | null> {
    // Convert string IDs to ObjectId
    const convertedFilter = convertFilterToObjectId(filterQuery);

    const document = await this.model
      .findOne(convertedFilter)
      .session(session || null)
      .lean<TSchema>(true);

    if (!document) {
      return null;
    }

    return document;
  }

  async find(
    filterQuery: FilterQuery<TSchema>,
    session?: ClientSession,
  ): Promise<TSchema[] | null> {
    // Convert string IDs to ObjectId
    const convertedFilter = convertFilterToObjectId(filterQuery);

    const document = await this.model
      .find(convertedFilter)
      .session(session || null)
      .lean<TSchema[]>(true);

    if (!document) {
      return null;
    }
    return document;
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<TSchema>,
    updateQuery: UpdateQuery<TSchema>,
    session?: ClientSession,
  ): Promise<TSchema | null> {
    // Convert string IDs to ObjectId
    const convertedFilter = convertFilterToObjectId(filterQuery);

    const document = await this.model
      .findOneAndUpdate(convertedFilter, updateQuery, {
        new: true,
        session: session || null,
      })
      .lean<TSchema>(true);

    if (!document) {
      return null;
    }

    return document;
  }

  async findOneAndDelete(
    filterQuery: FilterQuery<TSchema>,
    session?: ClientSession,
  ): Promise<TSchema | null> {
    // Convert string IDs to ObjectId
    const convertedFilter = convertFilterToObjectId(filterQuery);

    const document = await this.model
      .findOneAndDelete(convertedFilter, { session: session || null })
      .lean<TSchema>(true);

    if (!document) {
      return null;
    }

    return document;
  }
}

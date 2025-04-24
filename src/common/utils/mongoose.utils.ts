import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

/**
 * Safely converts a string ID to MongoDB ObjectId
 * @param id - The string ID to convert
 * @returns MongoDB ObjectId
 * @throws BadRequestException if the ID is invalid
 */
export function toObjectId(id: string): Types.ObjectId {
  try {
    return new Types.ObjectId(id);
  } catch (error) {
    throw new BadRequestException(
      `Invalid ID format: ${id}. Error: ${error.message}`,
    );
  }
}

/**
 * Safely converts a string ID to MongoDB ObjectId or returns null if invalid
 * @param id - The string ID to convert
 * @returns MongoDB ObjectId or null if invalid
 */
export function toObjectIdOrNull(id: string): Types.ObjectId | null {
  try {
    return new Types.ObjectId(id);
  } catch (error) {
    console.warn(
      `Failed to convert ID to ObjectId: ${id}. Error: ${error.message}`,
    );
    return null;
  }
}

/**
 * Converts a filter query to use ObjectId for _id fields
 * @param filter - The filter query to convert
 * @returns Filter query with ObjectId for _id fields
 */
export function convertFilterToObjectId(
  filter: Record<string, any>,
): Record<string, any> {
  const result = { ...filter };

  // Convert _id to ObjectId if it's a string
  if (result._id && typeof result._id === 'string') {
    result._id = toObjectId(result._id);
  }

  return result;
}

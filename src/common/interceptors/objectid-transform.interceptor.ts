import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Types } from 'mongoose';

@Injectable()
export class ObjectIdTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transformObjectIds(data)));
  }

  private transformObjectIds(obj: any): any {
    if (!obj) return obj;

    // Handle primitive types and special objects that should not be transformed
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Handle Date objects - preserve them as-is
    if (obj instanceof Date) {
      return obj;
    }

    // Handle RegExp objects - preserve them as-is
    if (obj instanceof RegExp) {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformObjectIds(item));
    }

    // Handle ObjectId instances
    if (obj instanceof Types.ObjectId) {
      return obj.toString();
    }

    // Handle the specific buffer format you're encountering
    if (obj.buffer && typeof obj.buffer === 'object') {
      try {
        // Handle both array-like buffer objects and Buffer instances
        let bufferData;

        if (obj.buffer.data && Array.isArray(obj.buffer.data)) {
          // Buffer with data array format
          bufferData = Buffer.from(obj.buffer.data);
        } else if (
          typeof obj.buffer === 'object' &&
          !Array.isArray(obj.buffer)
        ) {
          // Buffer object with numeric keys (your case)
          const keys = Object.keys(obj.buffer).filter(
            (key) => !isNaN(parseInt(key)),
          );
          const bytes = keys.map((key) => obj.buffer[key]);
          bufferData = Buffer.from(bytes);
        } else {
          // Direct buffer
          bufferData = Buffer.from(obj.buffer);
        }

        return new Types.ObjectId(bufferData).toString();
      } catch (error) {
        console.warn('Failed to convert buffer to ObjectId:', error.message);
        return obj;
      }
    }

    // Handle _id specifically (common MongoDB field)
    if (
      obj._id &&
      typeof obj._id === 'object' &&
      !(obj._id instanceof Types.ObjectId) &&
      !(obj._id instanceof Date)
    ) {
      const transformedId = this.transformObjectIds(obj._id);
      if (typeof transformedId === 'string') {
        return {
          ...this.transformObjectIds({ ...obj, _id: undefined }),
          _id: transformedId,
        };
      }
    }

    // Handle plain objects recursively
    const transformed: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        transformed[key] = this.transformObjectIds(obj[key]);
      }
    }
    return transformed;
  }
}

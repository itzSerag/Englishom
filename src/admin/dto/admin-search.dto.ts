import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AdminRole } from '../../common/shared';

export class AdminSearchDto {
  @IsOptional()
  @IsString()
  query?: string; // Search across email, firstName, lastName

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean; // Filter by active status

  @IsOptional()
  @IsEnum(AdminRole)
  adminRole: AdminRole; // Filter by admin role

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

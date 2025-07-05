import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../user/dto/pagination.dto';

export class DashboardSearchDto extends PaginationDto {
  // make the pagination with query only

  @IsString()
  @IsOptional()
  query?: string;
}

export class DashboardPaginationDto extends PaginationDto {
  // Inherits page and limit from PaginationDto
}

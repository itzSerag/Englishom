import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../user/dto/pagination.dto';

export class DashboardSearchDto extends PaginationDto {

  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}


export class DashboardPaginationDto extends PaginationDto {
  // Inherits page and limit from PaginationDto
}

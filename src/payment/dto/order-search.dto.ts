import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../user/dto/pagination.dto';

export enum OrderPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class OrderSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  // daily, weekly, monthly, yearly reports
  @IsOptional()
  @IsEnum(OrderPeriod)
  period?: OrderPeriod;

  // Base date for the period (ISO string). Defaults to "now" if omitted
  @IsOptional()
  @IsDateString()
  date?: string;
}

// Simplified DTO for reports: require period, no user/date filters
export class OrderReportDto {
  @IsNotEmpty()
  @IsEnum(OrderPeriod)
  period: OrderPeriod;
}

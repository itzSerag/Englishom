import { IsNumber, IsDate, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OverviewStatsDto {
  @IsNumber()
  totalUsers: number;

  @IsNumber()
  totalActiveUsers: number;

  @IsNumber()
  totalSuspendedUsers: number;

  @IsNumber()
  totalBlockedUsers: number;

  @IsNumber()
  totalRevenue: number;

  @IsNumber()
  totalSubscribedUsers: number;

  @IsNumber()
  totalCourses: number;
}

export class RecentActivityDto {
  @IsArray()
  recentOrders: any[];

  @IsArray()
  userGrowthData: any[];
}

export class AnalyticsDto {
  @IsArray()
  revenueByMonth: any[];

  @IsArray()
  coursePopularity: any[];
}

export class DashboardStatsDto {
  @ValidateNested()
  @Type(() => OverviewStatsDto)
  overview: OverviewStatsDto;

  @ValidateNested()
  @Type(() => RecentActivityDto)
  recentActivity: RecentActivityDto;

  @ValidateNested()
  @Type(() => AnalyticsDto)
  analytics: AnalyticsDto;

  @IsDate()
  @Type(() => Date)
  generatedAt: Date;
}

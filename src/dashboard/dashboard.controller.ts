import { 
  Controller, 
  Get, 
  Param, 
  Query,
  UseGuards,
  ValidationPipe,
  BadRequestException,
  Logger,
  Post,
  Body
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AdminRoles } from '../admin/decorators/admin-roles.decorator';
import { AdminRole } from '../common/shared/enums';
import { IsAdminGuard, AdminRoleGuard } from '../admin/guards';
import { DashboardSearchDto, DashboardPaginationDto, AssignCourseDto } from './dto';
import { SkipVerifiedGuard } from '../auth/guards/skip-verified.guard';

@UseGuards(IsAdminGuard, AdminRoleGuard)
@SkipVerifiedGuard()
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get comprehensive dashboard statistics -- main page
   * Access: SUPER and MANAGER only
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('stats')
  async getDashboardStats() {
    this.logger.log('Dashboard stats requested');
    return await this.dashboardService.getDashboardStats();
  }

  /**
   * Get detailed user information for course assignment
   * Access: SUPER and MANAGER only
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('user-details/:userId')
  async getUserDetails(@Param('userId') userId: string) {
    this.logger.log(`Fetching user details for: ${userId}`);
    return await this.dashboardService.getUserDetails(userId);
  }

  /**
   * Search users for course assignment with improved validation
   * Access: SUPER and MANAGER only
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Get('search-users')
  async searchUsers(@Query(ValidationPipe) searchDto: DashboardSearchDto) {
    this.logger.log(`Searching users with params:`, searchDto);
    return await this.dashboardService.searchUsers(searchDto);
  }


  /**
   * Assign a course to a user manually
   * Access: SUPER and MANAGER only
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Post('assign-course')
  async assignCourse(
    @Body() assignCourseDto: AssignCourseDto) {
    this.logger.log(`Assigning course with data:`, assignCourseDto);
    return await this.dashboardService.assignCourseToUser(assignCourseDto);
  }

  
}
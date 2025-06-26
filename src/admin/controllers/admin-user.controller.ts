import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole, UserStatus } from '../../common/shared';
import { IsAdminGuard } from '../guards/is-admin.guard';
import { AdminRoleGuard } from '../guards/admin-roles.guard';
import { UserService } from '../../user/user.service';
import { UpdateUserStatusDto } from '../../user/dto/update-user-status.dto';
import { PaginationDto } from '../../user/dto/pagination.dto';
import { cleanResponse } from '../../common/utils/response.utils';

@UseGuards(IsAdminGuard, AdminRoleGuard)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Update user status - suspend, activate, or block (SUPER and MANAGER only)
   */
  @AdminRoles(AdminRole.SUPER, AdminRole.MANAGER)
  @Patch('status/:id')
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ) {
    const user = await this.userService.updateUserStatus(id, updateStatusDto);
    return {
      message: `User status updated to ${updateStatusDto.status}`,
      user: cleanResponse(user),
    };
  }
}

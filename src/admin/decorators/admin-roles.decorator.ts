import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../../common/shared';

export const ADMIN_ROLES_KEY = 'admin-roles';
export const AdminRoles = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);

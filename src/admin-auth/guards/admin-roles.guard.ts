import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../common/shared';
import { Admin } from '../../admin/models/admin.schema';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<AdminRole[]>(
      'admin-roles',
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const admin: Admin = request.user;

    // Check if the route is public
    if (
      this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    // If the user is not authenticated
    if (!admin) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    // Check if user is actually an admin (using adminRole field)
    if (
      !admin.adminRole ||
      !Object.values(AdminRole).includes(admin.adminRole)
    ) {
      throw new ForbiddenException('User is not an admin');
    }

    // If no specific roles are required, allow any authenticated admin
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // SUPER admin can access everything
    if (admin.adminRole === AdminRole.SUPER) {
      return true;
    }

    // Check if admin has the required role
    if (!requiredRoles.includes(admin.adminRole)) {
      throw new ForbiddenException('Admin does not have the required role');
    }

    // check if the admin is active
    if (!admin.isActive) {
      throw new ForbiddenException('Admin account is deactivated');
    }

    return true;
  }
}

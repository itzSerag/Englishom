import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../common/shared';

@Injectable()
export class IsAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const admin = request.user;

    // Check if the route is public
    if (
      this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    // If the user/admin is not authenticated, throw UnauthorizedException
    if (!admin) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // Check if user is any type of admin (using adminRole field)
    if (
      !admin.adminRole ||
      !Object.values(AdminRole).includes(admin.adminRole)
    ) {
      throw new ForbiddenException('User is not an admin');
    }

    return true;
  }
}

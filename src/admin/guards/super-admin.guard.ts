import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../../common/shared';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

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

    if (!admin || admin.role !== AdminRole.SUPER) {
      throw new UnauthorizedException(
        'Only Super Admin can access this resource',
      );
    }

    return true;
  }
}

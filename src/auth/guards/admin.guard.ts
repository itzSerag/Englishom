import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { AdminRole } from '../../common/shared';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the route is public
    if (
      this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    // Check if user is an admin (new admin system)
    if (user && Object.values(AdminRole).includes(user.role)) {
      return true;
    }

    // Legacy check for backward compatibility
    if (user && (user.role === 'admin' || user.role === 'ADMIN')) {
      return true;
    }

    throw new UnauthorizedException("You don't have permission to access");
  }
}

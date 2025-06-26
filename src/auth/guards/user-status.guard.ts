import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus, Role } from '../../common/shared';
import { User } from '../../user/models/user.schema';

export const SKIP_USER_STATUS_KEY = 'skipUserStatus';
export const SkipUserStatusGuard = () =>
  SetMetadata(SKIP_USER_STATUS_KEY, true);

import { SetMetadata } from '@nestjs/common';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipGuard = this.reflector.get<boolean>(
      SKIP_USER_STATUS_KEY,
      context.getHandler(),
    );

    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic || skipGuard) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let other guards handle authentication
    }

    // Skip check for admin users
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Check user status
    const userEntity = user as User;
    if (userEntity.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        message:
          'Your account has been suspended. Please contact support to reactivate your account.',
        statusCode: 403,
        error: 'Account Suspended',
        suspendedAt: userEntity.suspendedAt,
        reason: userEntity.suspensionReason,
      });
    }

    if (userEntity.status === UserStatus.BLOCKED) {
      throw new ForbiddenException({
        message:
          'Your account has been permanently blocked. Please contact support.',
        statusCode: 403,
        error: 'Account Blocked',
      });
    }

    return true;
  }
}

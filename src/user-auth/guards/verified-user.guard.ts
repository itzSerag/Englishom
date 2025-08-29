// src/user-auth/guards/verified-user.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_VERIFIED_GUARD_KEY } from './skip-verified.guard';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipGuard = this.reflector.get<boolean>(
      SKIP_VERIFIED_GUARD_KEY,
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

    if (user?.adminRole) {
      return true;
    }

    if (!user) {
      throw new ForbiddenException('You must be logged in');
    }

    if (!user.isVerified) {
      throw new ForbiddenException(
        'Your account is not verified. Please verify your email.',
      );
    }

    return true;
  }
}

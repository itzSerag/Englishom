import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Try to authenticate, but don't throw if it fails
      await super.canActivate(context);
      return true;
    } catch (error) {
      // If authentication fails, continue without user
      return true;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Return user if authenticated, null if not (don't throw)
    return user || null;
  }
}

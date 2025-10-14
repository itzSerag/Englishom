import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { log } from 'console';

export const CurrentAdmin = createParamDecorator(
  (data: keyof any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // in case if we only need specific data from the admin

    log(data);

    return data ? request.user?.[data] : request.user;
  },
);

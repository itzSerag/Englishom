import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OptionalUser = createParamDecorator(
  (data: keyof any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);

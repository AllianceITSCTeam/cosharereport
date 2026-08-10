import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionPayload } from '../../auth/auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof SessionPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request & { user: SessionPayload }>();
    const user = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);

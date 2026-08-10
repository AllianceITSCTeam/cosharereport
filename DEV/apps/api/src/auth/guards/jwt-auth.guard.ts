import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SessionPayload } from '../auth.types';

const DEV_BYPASS_USER: SessionPayload = {
  sub: 'dev-bypass',
  name: 'Dev (auth disabled)',
  email: undefined,
  role: undefined,
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // TEMPORARY: set DISABLE_AUTH=true in .env to skip the sign-in check while
  // the CoShare SSO token format is still unconfirmed. Remove this override
  // once /sso is verified against a real CoShare-issued token.
  canActivate(context: ExecutionContext) {
    if (process.env.DISABLE_AUTH === 'true') {
      const request = context.switchToHttp().getRequest<Request & { user: SessionPayload }>();
      request.user = DEV_BYPASS_USER;
      return true;
    }
    return super.canActivate(context);
  }
}

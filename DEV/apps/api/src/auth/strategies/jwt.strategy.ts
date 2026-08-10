import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { SessionPayload } from '../auth.types';
import { SESSION_COOKIE_NAME } from '../auth.service';

function extractFromCookie(req: Request): string | null {
  return req?.cookies?.[SESSION_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: extractFromCookie,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('SESSION_JWT_SECRET'),
    });
  }

  validate(payload: SessionPayload): SessionPayload {
    return payload;
  }
}

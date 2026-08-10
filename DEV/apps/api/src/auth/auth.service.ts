import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CoshareTokenPayload, SessionPayload } from './auth.types';

export const SESSION_COOKIE_NAME = 'coshare_report_session';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Verifies a token minted by CoShare (HS256, shared secret) and returns its claims. */
  verifyCoshareToken(token: string): CoshareTokenPayload {
    const secret = this.configService.get<string>('COSHARE_JWT_SECRET');
    if (!secret) {
      throw new Error('COSHARE_JWT_SECRET is not configured');
    }
    try {
      return this.jwtService.verify<CoshareTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired CoShare token');
    }
  }

  /** Signs our own short-lived session token, stored in an httpOnly cookie. */
  issueSessionToken(payload: SessionPayload): string {
    const secret = this.configService.get<string>('SESSION_JWT_SECRET');
    if (!secret) {
      throw new Error('SESSION_JWT_SECRET is not configured');
    }
    return this.jwtService.sign(payload, { secret, expiresIn: '8h' });
  }
}

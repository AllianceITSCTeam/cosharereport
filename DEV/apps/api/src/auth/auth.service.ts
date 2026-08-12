import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CoshareOAuthResponse, CoshareTokenPayload, SessionPayload } from './auth.types';

export const SESSION_COOKIE_NAME = 'coshare_report_session';

const DEFAULT_COSHARE_TOKEN_URL = 'https://api-adm.coshare.vn/oauth2/token';
const DEFAULT_COSHARE_APP_NAME = 'CoShareAdmin';

/**
 * Decodes a JWT payload WITHOUT verifying the signature. Only safe when the token was
 * obtained directly from CoShare over TLS (our BFF login) — never for tokens arriving
 * from an untrusted channel (that path must verify; see docs SSO requirements).
 */
export function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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

  /**
   * BFF login: exchanges CoShare username/password for a session.
   * Calls CoShare's oauth2/token (password grant) server-side, then maps the returned
   * token/claims into our SessionPayload. The caller mints + sets our session cookie.
   * The password is never persisted or logged.
   */
  async loginWithPassword(username: string, password: string): Promise<SessionPayload> {
    const oauth = await this.requestCoshareToken(username, password);
    const claims = decodeJwtPayloadUnsafe(oauth.access_token) ?? {};

    const sub =
      (typeof claims.sub === 'string' && claims.sub) || oauth.user_id || '';
    const role = typeof claims.role === 'string' ? claims.role : undefined;
    const name = oauth.name || oauth.user_name || undefined;

    return { sub: String(sub), name, email: undefined, role };
  }

  /** Server-to-server call to CoShare's OAuth2 password-grant endpoint. */
  private async requestCoshareToken(
    username: string,
    password: string,
  ): Promise<CoshareOAuthResponse> {
    const tokenUrl =
      this.configService.get<string>('COSHARE_OAUTH_TOKEN_URL') ?? DEFAULT_COSHARE_TOKEN_URL;
    const appName =
      this.configService.get<string>('COSHARE_OAUTH_APP_NAME') ?? DEFAULT_COSHARE_APP_NAME;

    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      app_name: appName,
    });

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      });
    } catch {
      // Network / DNS / timeout — CoShare unreachable (do not leak details)
      throw new ServiceUnavailableException('Không kết nối được máy chủ đăng nhập CoShare');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    const data = (await response.json().catch(() => null)) as CoshareOAuthResponse | null;
    if (!data?.access_token) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    return data;
  }
}

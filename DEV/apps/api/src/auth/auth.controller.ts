import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SessionPayload } from './auth.types';

const SESSION_COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8h, matches issueSessionToken()

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Entry point for the link CoShare sends users to: /sso?token=<jwt>.
   * Verifies the CoShare token, mints our own session cookie, redirects into the app.
   */
  @Get('sso')
  sso(@Query('token') token: string, @Res() res: Response): void {
    if (!token) {
      res.redirect('/auth-error?reason=missing-token');
      return;
    }

    let claims;
    try {
      claims = this.authService.verifyCoshareToken(token);
    } catch {
      res.redirect('/auth-error?reason=invalid-token');
      return;
    }

    const sessionToken = this.authService.issueSessionToken({
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
      role: claims.role,
    });

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    const redirectTo = this.configService.get<string>('SSO_REDIRECT_PATH') ?? '/';
    res.redirect(redirectTo);
  }

  /**
   * BFF login: user submits their CoShare username/password from our login form.
   * We proxy to CoShare's oauth2/token (password grant) server-side, then mint our own
   * session cookie. Rate-limited via the strict `sso` throttle bucket (10/min).
   */
  @Throttle({ sso: { limit: 10, ttl: 60000 } })
  @Post('auth/login')
  async login(@Body() dto: LoginDto, @Res() res: Response): Promise<void> {
    const user = await this.authService.loginWithPassword(dto.username, dto.password);
    const sessionToken = this.authService.issueSessionToken(user);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_COOKIE_MAX_AGE,
    });

    // Mimic the global { success, data } envelope (bypassed because we use @Res()).
    res.status(200).json({ success: true, data: user });
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  me(@CurrentUser() user: SessionPayload): SessionPayload {
    return user;
  }

  @Post('auth/logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).send();
    void req;
  }
}

import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionPayload } from './auth.types';

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

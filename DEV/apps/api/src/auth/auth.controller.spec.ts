import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService, SESSION_COOKIE_NAME } from './auth.service';
import { ConfigService } from '@nestjs/config';

/**
 * Logout must CLEAR the session cookie with the same attributes it was set with
 * (httpOnly / secure / sameSite / path). If those differ, the browser keeps the
 * cookie and the user stays logged in — the bug this test guards against.
 */
describe('AuthController.logout', () => {
  const makeController = () =>
    new AuthController(
      {} as unknown as AuthService,
      {} as unknown as ConfigService,
    );

  const makeRes = () => {
    const res = {
      clearCookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response & typeof res;
  };

  it('clears the session cookie with attributes matching how it was set', () => {
    const controller = makeController();
    const res = makeRes();

    controller.logout({} as never, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('marks the cleared cookie secure only in production', () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const res = makeRes();
      makeController().logout({} as never, res);
      expect(res.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({ secure: true }),
      );

      process.env.NODE_ENV = 'development';
      const resDev = makeRes();
      makeController().logout({} as never, resDev);
      expect(resDev.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({ secure: false }),
      );
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

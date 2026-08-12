import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Unit tests for the BFF password-grant login (loginWithPassword).
 * The CoShare OAuth2 endpoint is mocked via global `fetch` — these never hit the network.
 * AuthService does NOT depend on Prisma / the database (readonly app, auth is DB-free).
 */
describe('AuthService.loginWithPassword (BFF -> CoShare oauth2/token)', () => {
  let service: AuthService;
  let fetchMock: jest.Mock;

  const TOKEN_URL = 'https://api-adm.coshare.vn/oauth2/token';
  const APP_NAME = 'CoShareAdmin';

  /** Build a decodable (unsigned/opaque-sig) JWT for tests. */
  const makeJwt = (payload: Record<string, unknown>): string => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.testsig`;
  };

  const mockResponse = (ok: boolean, body: unknown, status = ok ? 200 : 401) =>
    ({ ok, status, json: async () => body }) as unknown as Response;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const configValues: Record<string, string> = {
      COSHARE_OAUTH_TOKEN_URL: TOKEN_URL,
      COSHARE_OAUTH_APP_NAME: APP_NAME,
      SESSION_JWT_SECRET: 'test-session-secret',
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: (k: string) => configValues[k] } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('posts password grant to the CoShare token URL and maps claims into a SessionPayload', async () => {
    const accessToken = makeJwt({ sub: '1', role: 'user' });
    fetchMock.mockResolvedValue(
      mockResponse(true, {
        access_token: accessToken,
        token_type: 'Bearer',
        name: 'Admin',
        user_name: 'admin.alliance',
        user_id: '1',
      }),
    );

    const result = await service.loginWithPassword('admin.alliance', 's3cret');

    // Correct endpoint + form-urlencoded password grant
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TOKEN_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const sentBody = String(init.body);
    expect(sentBody).toContain('grant_type=password');
    expect(sentBody).toContain('username=admin.alliance');
    expect(sentBody).toContain(`app_name=${APP_NAME}`);

    // Claims mapped from JWT (sub, role) + display name from body
    expect(result).toEqual({
      sub: '1',
      name: 'Admin',
      email: undefined,
      role: 'user',
    });
  });

  it('never puts the raw password into logs or the returned payload', async () => {
    const accessToken = makeJwt({ sub: '1', role: 'user' });
    fetchMock.mockResolvedValue(
      mockResponse(true, { access_token: accessToken, name: 'Admin', user_id: '1' }),
    );

    const result = await service.loginWithPassword('admin.alliance', 'SuperSecretPw!');

    expect(JSON.stringify(result)).not.toContain('SuperSecretPw!');
  });

  it('throws UnauthorizedException when CoShare rejects the credentials (non-2xx)', async () => {
    fetchMock.mockResolvedValue(mockResponse(false, { error: 'invalid_grant' }, 401));

    await expect(service.loginWithPassword('admin.alliance', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the response has no access_token', async () => {
    fetchMock.mockResolvedValue(mockResponse(true, { token_type: 'Bearer' }));

    await expect(service.loginWithPassword('admin.alliance', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ServiceUnavailableException when the CoShare server is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.loginWithPassword('admin.alliance', 'x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('falls back to user_name for display name and user_id for sub when JWT lacks them', async () => {
    const accessToken = makeJwt({ role: 'user' }); // no sub in token
    fetchMock.mockResolvedValue(
      mockResponse(true, { access_token: accessToken, user_name: 'admin.alliance', user_id: '42' }),
    );

    const result = await service.loginWithPassword('admin.alliance', 'x');

    expect(result.sub).toBe('42');
    expect(result.name).toBe('admin.alliance');
    expect(result.role).toBe('user');
  });
});

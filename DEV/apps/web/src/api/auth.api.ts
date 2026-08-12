import { apiClient } from '@/lib/axios';
import type { ICurrentUser } from '@/stores/auth.store';

export async function getMeApi(): Promise<ICurrentUser> {
  const res = await apiClient.get<{ success: boolean; data: ICurrentUser }>('/auth/me');
  return res.data.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/**
 * BFF login — posts CoShare username/password to our API, which proxies to CoShare's
 * oauth2/token and sets the httpOnly session cookie. Returns the signed-in user.
 */
export async function loginApi(body: {
  username: string;
  password: string;
}): Promise<ICurrentUser> {
  const res = await apiClient.post<{ success: boolean; data: ICurrentUser }>(
    '/auth/login',
    body,
  );
  return res.data.data;
}

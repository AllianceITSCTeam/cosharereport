import { apiClient } from '@/lib/axios';
import type { ICurrentUser } from '@/stores/auth.store';

export async function getMeApi(): Promise<ICurrentUser> {
  const res = await apiClient.get<{ success: boolean; data: ICurrentUser }>('/auth/me');
  return res.data.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}

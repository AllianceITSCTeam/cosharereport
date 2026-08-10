import { apiClient } from '@/lib/axios';

export interface IHealthResponse {
  status: string;
  timestamp: string;
  startedAt: string;
  commit: string;
}

export async function getHealth(): Promise<IHealthResponse> {
  const res = await apiClient.get<{ success: boolean; data: IHealthResponse }>('/health');
  return res.data.data;
}

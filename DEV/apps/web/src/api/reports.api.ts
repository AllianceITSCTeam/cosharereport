import { apiClient } from '@/lib/axios';

export interface IReportsPing {
  connected: boolean;
}

export async function getReportsPingApi(): Promise<IReportsPing> {
  const res = await apiClient.get<{ success: boolean; data: IReportsPing }>('/reports/ping');
  return res.data.data;
}

export interface ILatestUser {
  Log_CreatedDate: string | null;
  DisplayName: string;
  Username: string;
}

export async function getLatestUsersApi(): Promise<ILatestUser[]> {
  const res = await apiClient.get<{ success: boolean; data: ILatestUser[] }>('/reports/latest-users');
  return res.data.data;
}

export interface ICommissionOverviewRow {
  companyId: string | null;
  companyName: string | null;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

export interface ICommissionOverviewQuery {
  from: string;
  to: string;
  timezone?: string;
}

export async function getCommissionOverviewApi(
  query: ICommissionOverviewQuery,
): Promise<ICommissionOverviewRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionOverviewRow[] }>(
    '/reports/commission/overview',
    { params: query },
  );
  return res.data.data;
}

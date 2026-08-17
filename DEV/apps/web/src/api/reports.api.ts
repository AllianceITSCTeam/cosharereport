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

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

async function fetchExportBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Xuất Excel thất bại (HTTP ${res.status})`);
  }
  return res.blob();
}

export async function getCommissionOverviewExportApi(query: ICommissionOverviewQuery): Promise<Blob> {
  return fetchExportBlob(`/api/reports/commission/overview/export?${toQueryString(query)}`);
}

export interface ICompanyOption {
  id: string;
  name: string | null;
}

export async function getCompaniesApi(): Promise<ICompanyOption[]> {
  const res = await apiClient.get<{ success: boolean; data: ICompanyOption[] }>('/reports/companies');
  return res.data.data;
}

export interface ICommissionByCompanyQuery {
  from: string;
  to: string;
  companyId: string;
  timezone?: string;
}

export interface ICommissionByPersonRow {
  sellerId: string;
  personName: string | null;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

export async function getCommissionByPersonApi(
  query: ICommissionByCompanyQuery,
): Promise<ICommissionByPersonRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionByPersonRow[] }>(
    '/reports/commission/by-person',
    { params: query },
  );
  return res.data.data;
}

export interface ICommissionByLevelRow {
  levelNo: number;
  levelName: string | null;
  totalCommission: string;
}

export async function getCommissionByLevelApi(
  query: ICommissionByCompanyQuery,
): Promise<ICommissionByLevelRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionByLevelRow[] }>(
    '/reports/commission/by-level',
    { params: query },
  );
  return res.data.data;
}

export async function getCommissionByCompanyExportApi(query: ICommissionByCompanyQuery): Promise<Blob> {
  return fetchExportBlob(`/api/reports/commission/by-company/export?${toQueryString(query)}`);
}

export interface ICommissionDetailQuery {
  from: string;
  to: string;
  companyId?: string;
  affiliateLevelId?: string;
  affiliateUserId?: string;
  msnv?: string;
  statusBill?: number;
  productType?: 'PHYSICAL' | 'NON_PHYSICAL';
  keyword?: string;
  page?: number;
  pageSize?: number;
  timezone?: string;
}

export interface ICommissionDetailRow {
  billId: string;
  orderCode: string | null;
  orderDate: string | null;
  buyerName: string | null;
  msnv: string | null;
  referrerName: string | null;
  beneficiaryName: string | null;
  orderTotal: string;
  commissionAmount: string;
  orderStatus: number | null;
}

export interface ICommissionDetailSummary {
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  sumOrderTotal: string;
  sumCommission: string;
}

export interface ICommissionDetailResult {
  rows: ICommissionDetailRow[];
  summary: ICommissionDetailSummary;
  pagination: { page: number; pageSize: number; totalCount: number };
}

export async function getCommissionDetailApi(
  query: ICommissionDetailQuery,
): Promise<ICommissionDetailResult> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionDetailResult }>(
    '/reports/commission/detail',
    { params: query },
  );
  return res.data.data;
}

export interface ICommissionDetailExportResult {
  blob: Blob;
  truncated: boolean;
}

export async function getCommissionDetailExportApi(
  query: Omit<ICommissionDetailQuery, 'page' | 'pageSize'>,
): Promise<ICommissionDetailExportResult> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const res = await fetch(`/api/reports/commission/detail/export?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Xuất Excel thất bại (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const truncated = res.headers.get('X-Export-Truncated') === 'true';
  return { blob, truncated };
}

export interface IMerchantBillDetailRow {
  itemName: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export async function getCommissionDetailItemsApi(billId: string): Promise<IMerchantBillDetailRow[]> {
  const res = await apiClient.get<{ success: boolean; data: IMerchantBillDetailRow[] }>(
    `/reports/commission/detail/${billId}/items`,
  );
  return res.data.data;
}

export interface ICommissionLevelOption {
  id: string;
  levelNo: number | null;
  name: string | null;
}

export async function getCommissionLevelsApi(): Promise<ICommissionLevelOption[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionLevelOption[] }>(
    '/reports/commission/levels',
  );
  return res.data.data;
}

export interface ICommissionBeneficiaryOption {
  id: string;
  name: string | null;
}

export interface ICommissionBeneficiariesQuery {
  from: string;
  to: string;
  companyId?: string;
  timezone?: string;
}

export async function getCommissionBeneficiariesApi(
  query: ICommissionBeneficiariesQuery,
): Promise<ICommissionBeneficiaryOption[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionBeneficiaryOption[] }>(
    '/reports/commission/beneficiaries',
    { params: query },
  );
  return res.data.data;
}

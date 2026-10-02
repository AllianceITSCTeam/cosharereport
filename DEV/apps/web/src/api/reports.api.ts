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

export type MerchantProductStatus = 'SELLING' | 'OUT_OF_STOCK' | 'HIDDEN';

export interface IMerchantProductQuery {
  code?: string;
  name?: string;
  groupProductId?: string;
  status?: MerchantProductStatus;
  page?: number;
  pageSize?: number;
}

export interface IMerchantProductRow {
  id: string;
  code: string | null;
  name: string | null;
  groupCode: string | null;
  groupName: string | null;
  status: MerchantProductStatus;
  link: string;
}

export interface IMerchantProductResult {
  rows: IMerchantProductRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

export async function getMerchantProductsApi(
  query: IMerchantProductQuery,
): Promise<IMerchantProductResult> {
  const res = await apiClient.get<{ success: boolean; data: IMerchantProductResult }>(
    '/reports/merchant-products',
    { params: query },
  );
  return res.data.data;
}

export interface IMerchantGroupProductOption {
  id: string;
  code: string | null;
  name: string | null;
}

export async function getMerchantProductGroupsApi(): Promise<IMerchantGroupProductOption[]> {
  const res = await apiClient.get<{ success: boolean; data: IMerchantGroupProductOption[] }>(
    '/reports/merchant-products/groups',
  );
  return res.data.data;
}

export type SalesCountSortBy = 'salesCount' | 'code' | 'name';
export type SalesCountSortDir = 'asc' | 'desc';

export interface ISalesCountQuery {
  from: string;
  to: string;
  timezone?: string;
  code?: string;
  name?: string;
  groupProductId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SalesCountSortBy;
  sortDir?: SalesCountSortDir;
}

export interface ISalesCountRow {
  id: string;
  code: string | null;
  name: string | null;
  groupCode: string | null;
  groupName: string | null;
  salesCount: number;
}

export interface ISalesCountResult {
  rows: ISalesCountRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

export async function getSalesCountApi(query: ISalesCountQuery): Promise<ISalesCountResult> {
  const res = await apiClient.get<{ success: boolean; data: ISalesCountResult }>(
    '/reports/sales-count',
    { params: query },
  );
  return res.data.data;
}

export interface IDashboardTopCtvRow {
  affiliateUserId: string;
  displayName: string | null;
  totalCommission: string;
}

export interface IDashboardTopCtvQuery {
  month?: string;
}

export async function getDashboardTopCtvApi(
  query: IDashboardTopCtvQuery = {},
): Promise<IDashboardTopCtvRow[]> {
  const res = await apiClient.get<{ success: boolean; data: IDashboardTopCtvRow[] }>(
    '/reports/dashboard/top-ctv',
    { params: query },
  );
  return res.data.data;
}

export interface ICommissionTrendRow {
  month: string;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

export interface ICommissionTrendQuery {
  toMonth?: string;
  months?: number;
  timezone?: string;
}

export async function getCommissionTrendApi(
  query: ICommissionTrendQuery = {},
): Promise<ICommissionTrendRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionTrendRow[] }>(
    '/reports/commission/trend',
    { params: query },
  );
  return res.data.data;
}

export interface ITopGroupProductsQuery {
  from: string;
  to: string;
  timezone?: string;
  page?: number;
  pageSize?: number;
  sortDir?: 'asc' | 'desc';
}

export interface ITopGroupProductRow {
  id: string;
  code: string | null;
  name: string | null;
  salesCount: number;
}

export interface ITopGroupProductsResult {
  rows: ITopGroupProductRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

export async function getTopGroupProductsApi(
  query: ITopGroupProductsQuery,
): Promise<ITopGroupProductsResult> {
  const res = await apiClient.get<{ success: boolean; data: ITopGroupProductsResult }>(
    '/reports/sales-count/by-group',
    { params: query },
  );
  return res.data.data;
}

export interface IDashboardCtvReferralRow {
  userLoginId: string;
  displayName: string | null;
  referralCode: string | null;
  directReferrals: number;
}

export interface IDashboardCtvReferralQuery {
  month?: string;
}

export async function getDashboardTopCtvReferralApi(
  query: IDashboardCtvReferralQuery = {},
): Promise<IDashboardCtvReferralRow[]> {
  const res = await apiClient.get<{ success: boolean; data: IDashboardCtvReferralRow[] }>(
    '/reports/dashboard/top-ctv-referral',
    { params: query },
  );
  return res.data.data;
}

export interface IDashboardCommissionByLevelQuery {
  from: string;
  to: string;
  timezone?: string;
}

export async function getDashboardCommissionByLevelApi(
  query: IDashboardCommissionByLevelQuery,
): Promise<ICommissionByLevelRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ICommissionByLevelRow[] }>(
    '/reports/dashboard/commission-by-level',
    { params: query },
  );
  return res.data.data;
}

export interface IOrderStatusBreakdownQuery {
  from: string;
  to: string;
  timezone?: string;
}

export interface IOrderStatusBreakdownResult {
  success: number;
  cancelled: number;
  other: number;
  total: number;
}

export async function getOrderStatusBreakdownApi(
  query: IOrderStatusBreakdownQuery,
): Promise<IOrderStatusBreakdownResult> {
  const res = await apiClient.get<{ success: boolean; data: IOrderStatusBreakdownResult }>(
    '/reports/dashboard/order-status-breakdown',
    { params: query },
  );
  return res.data.data;
}

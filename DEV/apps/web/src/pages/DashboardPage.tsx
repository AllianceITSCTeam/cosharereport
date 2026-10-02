import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCommissionOverviewApi,
  getCommissionTrendApi,
  getDashboardCommissionByLevelApi,
  getDashboardTopCtvApi,
  getDashboardTopCtvReferralApi,
  getOrderStatusBreakdownApi,
  getSalesCountApi,
  getTopGroupProductsApi,
} from '@/api/reports.api';
import { LineChart } from '@/components/charts/LineChart';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { SimplePieChart } from '@/components/charts/SimplePieChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';

/**
 * Categorical palette for the "theo công ty"/"theo cấp hệ" pie charts — validated with
 * the dataviz skill's palette checker (adjacent-pair CVD Delta E >= 8, normal-vision >= 15
 * on this exact order); unlike CommissionByCompanyPage's LEVEL_COLORS, this one passes.
 * Extra slices beyond 8 fold into "Khác" rather than reusing/cycling a hue.
 */
const CATEGORICAL_CHART_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

/**
 * Status palette (not categorical identity) for the order-status breakdown — good/critical
 * are the dataviz skill's reserved status colors; "Khác" reuses the app's own
 * --muted-foreground token (#64748B) rather than inventing a new neutral.
 */
const ORDER_STATUS_COLORS = {
  success: '#0ca30c',
  cancelled: '#d03b3b',
  other: '#64748B',
};

const MONTH_STORAGE_KEY = 'dashboard.month';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Giữ filter tháng qua lần reload — đọc/ghi localStorage, bỏ qua nếu bị chặn (private browsing...). */
function getStoredMonth(): string | null {
  try {
    return localStorage.getItem(MONTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeMonth(month: string): void {
  try {
    localStorage.setItem(MONTH_STORAGE_KEY, month);
  } catch {
    // ignore — private browsing / storage disabled
  }
}

function getMonthRange(month: string): { from: string; to: string } {
  const [year, monthNo] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNo, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' đ';
}

function formatMonthLabel(month: string): string {
  const [year, monthNo] = month.split('-');
  return `Thg ${monthNo}/${year}`;
}

export function DashboardPage() {
  const [month, setMonthState] = useState(() => getStoredMonth() ?? getCurrentMonth());
  const { from, to } = getMonthRange(month);

  function setMonth(value: string) {
    setMonthState(value);
    storeMonth(value);
  }

  const topProductsQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'top-products', month],
    queryFn: () =>
      getSalesCountApi({ from, to, sortBy: 'salesCount', sortDir: 'desc', page: 1, pageSize: 5 }),
  });

  const topCtvQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'top-ctv', month],
    queryFn: () => getDashboardTopCtvApi({ month }),
  });

  const commissionOverviewQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'commission-overview', month],
    queryFn: () => getCommissionOverviewApi({ from, to }),
  });

  const commissionTrendQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'commission-trend', month],
    queryFn: () => getCommissionTrendApi({ toMonth: month, months: 6 }),
  });

  const topGroupProductsQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'top-group-products', month],
    queryFn: () => getTopGroupProductsApi({ from, to, page: 1, pageSize: 5, sortDir: 'desc' }),
  });

  const topCtvReferralQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'top-ctv-referral', month],
    queryFn: () => getDashboardTopCtvReferralApi({ month }),
  });

  const commissionByLevelQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'commission-by-level', month],
    queryFn: () => getDashboardCommissionByLevelApi({ from, to }),
  });

  const orderStatusBreakdownQuery = useQuery({
    queryKey: ['reports', 'dashboard', 'order-status-breakdown', month],
    queryFn: () => getOrderStatusBreakdownApi({ from, to }),
  });

  const topProducts = (topProductsQuery.data?.rows ?? [])
    .filter((r) => r.salesCount > 0)
    .map((r) => ({ label: r.name ?? r.code ?? '—', value: r.salesCount }));

  const topCtv = (topCtvQuery.data ?? []).map((r) => ({
    label: r.displayName ?? '—',
    value: Number(r.totalCommission),
  }));

  const commissionByCompanyRows = (commissionOverviewQuery.data ?? []).filter(
    (r) => Number(r.totalCommission) > 0,
  );
  const commissionByCompany = [
    ...commissionByCompanyRows.slice(0, CATEGORICAL_CHART_COLORS.length).map((r, index) => ({
      label: r.companyName ?? 'Chưa xác định',
      value: Number(r.totalCommission),
      color: CATEGORICAL_CHART_COLORS[index],
    })),
    ...(commissionByCompanyRows.length > CATEGORICAL_CHART_COLORS.length
      ? [
          {
            label: 'Khác',
            value: commissionByCompanyRows
              .slice(CATEGORICAL_CHART_COLORS.length)
              .reduce((sum, r) => sum + Number(r.totalCommission), 0),
            color: '#898781',
          },
        ]
      : []),
  ];

  const commissionTrend = (commissionTrendQuery.data ?? []).map((r) => ({
    label: formatMonthLabel(r.month),
    value: Number(r.totalCommission),
  }));

  const topGroupProducts = (topGroupProductsQuery.data?.rows ?? [])
    .filter((r) => r.salesCount > 0)
    .map((r) => ({ label: r.name ?? r.code ?? '—', value: r.salesCount }));

  const topCtvReferral = (topCtvReferralQuery.data ?? [])
    .filter((r) => r.directReferrals > 0)
    .map((r) => ({ label: r.displayName ?? r.referralCode ?? '—', value: r.directReferrals }));

  const commissionByLevelRows = (commissionByLevelQuery.data ?? []).filter(
    (r) => Number(r.totalCommission) > 0,
  );
  const commissionByLevel = [
    ...commissionByLevelRows.slice(0, CATEGORICAL_CHART_COLORS.length).map((r, index) => ({
      label: r.levelName ?? `Cấp ${r.levelNo}`,
      value: Number(r.totalCommission),
      color: CATEGORICAL_CHART_COLORS[index],
    })),
    ...(commissionByLevelRows.length > CATEGORICAL_CHART_COLORS.length
      ? [
          {
            label: 'Khác',
            value: commissionByLevelRows
              .slice(CATEGORICAL_CHART_COLORS.length)
              .reduce((sum, r) => sum + Number(r.totalCommission), 0),
            color: '#898781',
          },
        ]
      : []),
  ];

  const orderStatusBreakdown = orderStatusBreakdownQuery.data;
  const orderStatusSlices = orderStatusBreakdown
    ? [
        { label: 'Thành công', value: orderStatusBreakdown.success, color: ORDER_STATUS_COLORS.success },
        { label: 'Huỷ', value: orderStatusBreakdown.cancelled, color: ORDER_STATUS_COLORS.cancelled },
        { label: 'Khác', value: orderStatusBreakdown.other, color: ORDER_STATUS_COLORS.other },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Tổng quan theo tháng.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dashboard-month" className="text-xs font-medium text-muted-foreground">
            Tháng
          </label>
          <input
            id="dashboard-month"
            type="month"
            value={month}
            max={getCurrentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="h-11 rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Top 5 sản phẩm bán chạy nhất
          </h2>
          {topProductsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {topProductsQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!topProductsQuery.isLoading && !topProductsQuery.isError && topProducts.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào bán ra trong tháng này.</p>
          )}
          {!topProductsQuery.isLoading && !topProductsQuery.isError && topProducts.length > 0 && (
            <SimpleBarChart data={topProducts} formatValue={formatNumber} />
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Hoa hồng theo công ty
          </h2>
          {commissionOverviewQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {commissionOverviewQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!commissionOverviewQuery.isLoading &&
            !commissionOverviewQuery.isError &&
            commissionByCompany.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có hoa hồng nào trong tháng này.</p>
            )}
          {!commissionOverviewQuery.isLoading &&
            !commissionOverviewQuery.isError &&
            commissionByCompany.length > 0 && (
              <SimplePieChart data={commissionByCompany} size={160} formatValue={formatCurrency} />
            )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Top 5 CTV doanh thu cao nhất
          </h2>
          {topCtvQuery.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
          {topCtvQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!topCtvQuery.isLoading && !topCtvQuery.isError && topCtv.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có CTV nào phát sinh hoa hồng trong tháng này.</p>
          )}
          {!topCtvQuery.isLoading && !topCtvQuery.isError && topCtv.length > 0 && (
            <VerticalBarChart data={topCtv} formatValue={formatCurrency} />
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Top nhóm hàng bán chạy
          </h2>
          {topGroupProductsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {topGroupProductsQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!topGroupProductsQuery.isLoading &&
            !topGroupProductsQuery.isError &&
            topGroupProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có nhóm hàng nào bán ra trong tháng này.</p>
            )}
          {!topGroupProductsQuery.isLoading &&
            !topGroupProductsQuery.isError &&
            topGroupProducts.length > 0 && (
              <SimpleBarChart data={topGroupProducts} formatValue={formatNumber} />
            )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Hoa hồng theo cấp hệ (toàn hệ thống)
          </h2>
          {commissionByLevelQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {commissionByLevelQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!commissionByLevelQuery.isLoading &&
            !commissionByLevelQuery.isError &&
            commissionByLevel.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có hoa hồng nào trong tháng này.</p>
            )}
          {!commissionByLevelQuery.isLoading &&
            !commissionByLevelQuery.isError &&
            commissionByLevel.length > 0 && (
              <SimplePieChart data={commissionByLevel} size={160} formatValue={formatCurrency} />
            )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Top 5 CTV giới thiệu nhiều người nhất
          </h2>
          {topCtvReferralQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {topCtvReferralQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!topCtvReferralQuery.isLoading &&
            !topCtvReferralQuery.isError &&
            topCtvReferral.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có CTV nào giới thiệu người mới trong tháng này.</p>
            )}
          {!topCtvReferralQuery.isLoading &&
            !topCtvReferralQuery.isError &&
            topCtvReferral.length > 0 && (
              <VerticalBarChart data={topCtvReferral} formatValue={formatNumber} />
            )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Xu hướng hoa hồng 6 tháng gần nhất
          </h2>
          {commissionTrendQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {commissionTrendQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!commissionTrendQuery.isLoading &&
            !commissionTrendQuery.isError &&
            commissionTrend.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu trong khoảng thời gian này.</p>
            )}
          {!commissionTrendQuery.isLoading &&
            !commissionTrendQuery.isError &&
            commissionTrend.length > 0 && (
              <LineChart data={commissionTrend} formatValue={formatCurrency} />
            )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Tỷ lệ đơn thành công/huỷ
          </h2>
          {orderStatusBreakdownQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {orderStatusBreakdownQuery.isError && (
            <p className="text-sm text-destructive">Không tải được dữ liệu.</p>
          )}
          {!orderStatusBreakdownQuery.isLoading &&
            !orderStatusBreakdownQuery.isError &&
            orderStatusSlices.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có đơn hàng nào trong tháng này.</p>
            )}
          {!orderStatusBreakdownQuery.isLoading &&
            !orderStatusBreakdownQuery.isError &&
            orderStatusSlices.length > 0 && (
              <SimplePieChart data={orderStatusSlices} size={160} formatValue={formatNumber} />
            )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import {
  getCompaniesApi,
  getCommissionByPersonApi,
  getCommissionByLevelApi,
  getCommissionByCompanyExportApi,
} from '@/api/reports.api';
import { DateRangePresetPicker } from '@/components/filters/DateRangePresetPicker';
import { FilterActions } from '@/components/filters/FilterActions';
import { useFilterState } from '@/components/filters/hooks/useFilterState';
import { SimplePieChart } from '@/components/charts/SimplePieChart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const LEVEL_COLORS = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#dc2626'];

function formatMoney(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : String(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function CommissionByCompanyPage() {
  const today = useMemo(() => new Date(), []);
  const [filters, setFilters, resetFilters] = useFilterState({
    key: 'report-commission-by-company-filters',
    mode: 'localStorage',
    defaultValue: {
      startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
      companyId: '',
    },
  });
  const { startDate, endDate, companyId } = filters;
  const range = { startDate, endDate };

  const [searchParams, setSearchParams] = useSearchParams();

  // Apply incoming filters from another report's "drill down" link (e.g. commission-overview),
  // then clear them from the URL so they don't linger and get out of sync with localStorage.
  useEffect(() => {
    const spCompanyId = searchParams.get('companyId');
    const spStartDate = searchParams.get('startDate');
    const spEndDate = searchParams.get('endDate');
    if (spCompanyId === null && spStartDate === null && spEndDate === null) return;

    setFilters((prev) => ({
      startDate: spStartDate ?? prev.startDate,
      endDate: spEndDate ?? prev.endDate,
      companyId: spCompanyId ?? prev.companyId,
    }));
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRange = Boolean(range.startDate && range.endDate);
  const hasCompany = Boolean(companyId);
  const [isExporting, setIsExporting] = useState(false);

  const { data: companyOptions = [] } = useQuery({
    queryKey: ['reports', 'companies'],
    queryFn: getCompaniesApi,
  });

  const byPersonQuery = useQuery({
    queryKey: ['reports', 'commission-by-person', companyId, range.startDate, range.endDate],
    queryFn: () => getCommissionByPersonApi({ from: range.startDate, to: range.endDate, companyId }),
    enabled: hasRange && hasCompany,
  });

  const byLevelQuery = useQuery({
    queryKey: ['reports', 'commission-by-level', companyId, range.startDate, range.endDate],
    queryFn: () => getCommissionByLevelApi({ from: range.startDate, to: range.endDate, companyId }),
    enabled: hasRange && hasCompany,
  });

  const personRows = byPersonQuery.data ?? [];
  const levelRows = byLevelQuery.data ?? [];

  const totals = useMemo(
    () =>
      personRows.reduce(
        (acc, r) => ({
          revenue: acc.revenue + Number(r.revenue),
          totalOrders: acc.totalOrders + r.totalOrders,
          successOrders: acc.successOrders + r.successOrders,
          cancelledOrders: acc.cancelledOrders + r.cancelledOrders,
          totalCommission: acc.totalCommission + Number(r.totalCommission),
        }),
        { revenue: 0, totalOrders: 0, successOrders: 0, cancelledOrders: 0, totalCommission: 0 },
      ),
    [personRows],
  );

  const pieData = levelRows.map((r, i) => ({
    label: r.levelName ?? `Cấp ${r.levelNo}`,
    value: Number(r.totalCommission),
    color: LEVEL_COLORS[i % LEVEL_COLORS.length],
  }));

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await getCommissionByCompanyExportApi({
        from: range.startDate,
        to: range.endDate,
        companyId,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoa-hong-theo-cong-ty-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hoa hồng theo công ty</h1>
        <p className="text-sm text-muted-foreground">
          Drill-down hoa hồng theo người bán và phân bổ theo cấp hệ, trong 1 công ty.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="company-select" className="text-xs font-medium text-muted-foreground">
            Công ty
          </label>
          <select
            id="company-select"
            value={companyId}
            onChange={(e) => setFilters((prev) => ({ ...prev, companyId: e.target.value }))}
            className="h-11 min-w-[220px] rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
          >
            <option value="">— Chọn công ty —</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.id}
              </option>
            ))}
          </select>
        </div>

        <DateRangePresetPicker
          value={range}
          onChange={(v) =>
            setFilters((prev) => ({ ...prev, startDate: v.startDate ?? '', endDate: v.endDate ?? '' }))
          }
          className="max-w-xs"
          label="Khoảng ngày"
        />

        <FilterActions
          onReset={resetFilters}
          onExport={hasRange && hasCompany ? handleExport : undefined}
          isExporting={isExporting}
          exportLabel="Xuất Excel"
          exportingLabel="Đang xuất..."
          testIdPrefix="by-company-filter"
        />
      </div>

      {!hasCompany && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Chọn 1 công ty để xem dữ liệu.
        </div>
      )}

      {hasCompany && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border bg-card">
            {(byPersonQuery.isLoading) && (
              <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>
            )}

            {byPersonQuery.isError && (
              <div className="p-6 text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
            )}

            {!byPersonQuery.isLoading && !byPersonQuery.isError && personRows.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                Không có dữ liệu trong khoảng ngày đã chọn.
              </div>
            )}

            {!byPersonQuery.isLoading && !byPersonQuery.isError && personRows.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead className="text-right">Tổng doanh thu</TableHead>
                    <TableHead className="text-right">Tổng đơn</TableHead>
                    <TableHead className="text-right">Thành công</TableHead>
                    <TableHead className="text-right">Huỷ</TableHead>
                    <TableHead className="text-right">Hoa hồng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personRows.map((row) => (
                    <TableRow key={row.sellerId} className={byPersonQuery.isFetching ? 'opacity-60' : undefined}>
                      <TableCell className="font-medium text-foreground">
                        {row.personName ?? row.sellerId}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMoney(row.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCount(row.totalOrders)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCount(row.successOrders)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCount(row.cancelledOrders)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMoney(row.totalCommission)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold text-foreground">
                    <TableCell>Tổng cộng</TableCell>
                    <TableCell className="text-right">{formatMoney(String(totals.revenue))}</TableCell>
                    <TableCell className="text-right">{formatCount(totals.totalOrders)}</TableCell>
                    <TableCell className="text-right">{formatCount(totals.successOrders)}</TableCell>
                    <TableCell className="text-right">{formatCount(totals.cancelledOrders)}</TableCell>
                    <TableCell className="text-right">{formatMoney(String(totals.totalCommission))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Hoa hồng theo cấp hệ</h2>

            {byLevelQuery.isLoading && (
              <div className="text-sm text-muted-foreground">Đang tải...</div>
            )}

            {byLevelQuery.isError && (
              <div className="text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
            )}

            {!byLevelQuery.isLoading && !byLevelQuery.isError && levelRows.length === 0 && (
              <div className="text-sm text-muted-foreground">Không có dữ liệu trong khoảng ngày đã chọn.</div>
            )}

            {!byLevelQuery.isLoading && !byLevelQuery.isError && levelRows.length > 0 && (
              <SimplePieChart data={pieData} formatValue={formatMoney} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import {
  getCommissionOverviewApi,
  getCommissionOverviewExportApi,
  type ICommissionOverviewRow,
} from '@/api/reports.api';
import { DateRangePresetPicker } from '@/components/filters/DateRangePresetPicker';
import { FilterActions } from '@/components/filters/FilterActions';
import { useFilterState } from '@/components/filters/hooks/useFilterState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const UNKNOWN_COMPANY_LABEL = 'Không xác định';

function formatMoney(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : value;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function sumTotals(rows: ICommissionOverviewRow[]) {
  return rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + Number(r.revenue),
      totalOrders: acc.totalOrders + r.totalOrders,
      successOrders: acc.successOrders + r.successOrders,
      cancelledOrders: acc.cancelledOrders + r.cancelledOrders,
      totalCommission: acc.totalCommission + Number(r.totalCommission),
    }),
    { revenue: 0, totalOrders: 0, successOrders: 0, cancelledOrders: 0, totalCommission: 0 },
  );
}

export function CommissionOverviewPage() {
  const today = useMemo(() => new Date(), []);
  const [range, setRange, resetRange] = useFilterState({
    key: 'report-commission-overview-filters',
    mode: 'localStorage',
    defaultValue: {
      startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    },
  });

  const hasRange = Boolean(range.startDate && range.endDate);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['reports', 'commission-overview', range.startDate, range.endDate],
    queryFn: () =>
      getCommissionOverviewApi({ from: range.startDate!, to: range.endDate! }),
    enabled: hasRange,
  });

  const totals = useMemo(() => sumTotals(data ?? []), [data]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await getCommissionOverviewExportApi({ from: range.startDate!, to: range.endDate! });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoa-hong-tong-quan-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`;
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
        <h1 className="text-xl font-semibold text-foreground">Hoa hồng tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Doanh thu, đơn hàng và hoa hồng theo từng Công ty trong khoảng ngày đã chọn.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <DateRangePresetPicker
          value={range}
          onChange={(v) => setRange({ startDate: v.startDate ?? '', endDate: v.endDate ?? '' })}
          className="max-w-xs"
          label="Khoảng ngày"
        />
        <FilterActions
          onReset={resetRange}
          onExport={hasRange ? handleExport : undefined}
          isExporting={isExporting}
          exportLabel="Xuất Excel"
          exportingLabel="Đang xuất..."
          testIdPrefix="overview-filter"
        />
      </div>

      <div className="rounded-lg border bg-card">
        {!hasRange && (
          <div className="p-6 text-sm text-muted-foreground">Chọn khoảng ngày để xem báo cáo.</div>
        )}

        {hasRange && isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>
        )}

        {hasRange && isError && (
          <div className="p-6 text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
        )}

        {hasRange && !isLoading && !isError && data && data.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Không có dữ liệu trong khoảng ngày đã chọn.</div>
        )}

        {hasRange && !isLoading && !isError && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cty</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Tổng đơn</TableHead>
                <TableHead className="text-right">Thành công</TableHead>
                <TableHead className="text-right">Huỷ</TableHead>
                <TableHead className="text-right">Hoa hồng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.companyId ?? 'unmapped'} className={isFetching ? 'opacity-60' : undefined}>
                  <TableCell className="font-medium text-foreground">
                    {row.companyId ? (
                      <Link
                        to={`/reports/commission-by-company?companyId=${encodeURIComponent(row.companyId)}&startDate=${encodeURIComponent(range.startDate ?? '')}&endDate=${encodeURIComponent(range.endDate ?? '')}`}
                        className="hover:underline"
                      >
                        {row.companyName ?? UNKNOWN_COMPANY_LABEL}
                      </Link>
                    ) : (
                      row.companyName ?? UNKNOWN_COMPANY_LABEL
                    )}
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
    </div>
  );
}

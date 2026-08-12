import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, format } from 'date-fns';
import {
  getCompaniesApi,
  getCommissionByPersonApi,
  getCommissionByLevelApi,
} from '@/api/reports.api';
import { DateRangePresetPicker } from '@/components/filters/DateRangePresetPicker';
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
  const [range, setRange] = useState({
    startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  });
  const [companyId, setCompanyId] = useState('');

  const hasRange = Boolean(range.startDate && range.endDate);
  const hasCompany = Boolean(companyId);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hoa hồng theo công ty</h1>
        <p className="text-sm text-muted-foreground">
          Drill-down hoa hồng theo người bán và phân bổ theo cấp hệ, trong 1 công ty.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="company-select" className="text-xs font-medium text-muted-foreground">
            Công ty
          </label>
          <select
            id="company-select"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
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
          onChange={(v) => setRange({ startDate: v.startDate ?? '', endDate: v.endDate ?? '' })}
          className="max-w-xs"
          label="Khoảng ngày"
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

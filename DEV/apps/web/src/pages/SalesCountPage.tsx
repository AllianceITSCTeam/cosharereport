import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
  getMerchantProductGroupsApi,
  getSalesCountApi,
  type SalesCountSortBy,
  type SalesCountSortDir,
} from '@/api/reports.api';
import { DateRangePresetPicker } from '@/components/filters/DateRangePresetPicker';
import { FilterActions } from '@/components/filters/FilterActions';
import { useFilterState } from '@/components/filters/hooks/useFilterState';
import { SearchableSelect } from '@/components/filters/SearchableSelect';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function SalesCountPage() {
  const today = useMemo(() => new Date(), []);
  const [filters, setFilters, resetFilters] = useFilterState({
    key: 'report-sales-count-filters',
    mode: 'localStorage',
    defaultValue: {
      startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
      code: '',
      name: '',
      groupProductId: '',
    },
  });
  const { startDate, endDate, code, name, groupProductId } = filters;
  const range = { startDate, endDate };
  const hasRange = Boolean(range.startDate && range.endDate);
  // Gõ liên tục không gọi API ngay mỗi phím — tránh dồn request gây ThrottlerException (429).
  const debouncedCode = useDebounce(code, 300);
  const debouncedName = useDebounce(name, 300);

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SalesCountSortBy>('salesCount');
  const [sortDir, setSortDir] = useState<SalesCountSortDir>('desc');
  const pageSize = 50;

  const { data: groupOptions = [] } = useQuery({
    queryKey: ['reports', 'merchant-product-groups'],
    queryFn: getMerchantProductGroupsApi,
  });

  const salesCountQuery = useQuery({
    queryKey: [
      'reports',
      'sales-count',
      range.startDate,
      range.endDate,
      debouncedCode,
      debouncedName,
      groupProductId,
      sortBy,
      sortDir,
      page,
    ],
    queryFn: () =>
      getSalesCountApi({
        from: range.startDate,
        to: range.endDate,
        code: debouncedCode || undefined,
        name: debouncedName || undefined,
        groupProductId: groupProductId || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    enabled: hasRange,
  });

  const resetToFirstPage = () => setPage(1);

  const handleResetFilters = () => {
    resetFilters();
    resetToFirstPage();
  };

  const handleSort = (column: SalesCountSortBy) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    resetToFirstPage();
  };

  const sortIcon = (column: SalesCountSortBy) => {
    if (sortBy !== column) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === 'desc' ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />;
  };

  const rows = salesCountQuery.data?.rows ?? [];
  const pagination = salesCountQuery.data?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Thống kê lượt bán</h1>
        <p className="text-sm text-muted-foreground">
          Toàn bộ sản phẩm trong hệ thống, kèm lượt bán (tổng số lượng của đơn thành công) trong khoảng ngày lọc.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <DateRangePresetPicker
          value={range}
          onChange={(v) => {
            setFilters((prev) => ({ ...prev, startDate: v.startDate ?? '', endDate: v.endDate ?? '' }));
            resetToFirstPage();
          }}
          className="max-w-xs"
          label="Khoảng ngày"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="code-input" className="text-xs font-medium text-muted-foreground">
            Mã sản phẩm
          </label>
          <input
            id="code-input"
            value={code}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, code: e.target.value }));
              resetToFirstPage();
            }}
            className="h-11 min-w-[160px] rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
            placeholder="Mã sản phẩm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="name-input" className="text-xs font-medium text-muted-foreground">
            Tên sản phẩm
          </label>
          <input
            id="name-input"
            value={name}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, name: e.target.value }));
              resetToFirstPage();
            }}
            className="h-11 min-w-[200px] rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
            placeholder="Tên sản phẩm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="group-select" className="text-xs font-medium text-muted-foreground">
            Nhóm sản phẩm
          </label>
          <SearchableSelect
            id="group-select"
            className="min-w-[200px]"
            value={groupProductId}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, groupProductId: next }));
              resetToFirstPage();
            }}
            options={groupOptions.map((g) => ({ value: g.id, label: g.name ?? g.code ?? g.id }))}
            searchPlaceholder="Tìm nhóm sản phẩm..."
          />
        </div>

        <FilterActions onReset={handleResetFilters} testIdPrefix="sales-count-filter" />
      </div>

      <div className="rounded-lg border bg-card">
        {!hasRange && (
          <div className="p-6 text-sm text-muted-foreground">Vui lòng chọn khoảng ngày để xem báo cáo.</div>
        )}

        {hasRange && salesCountQuery.isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>
        )}

        {hasRange && salesCountQuery.isError && (
          <div className="p-6 text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
        )}

        {hasRange && !salesCountQuery.isLoading && !salesCountQuery.isError && rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            Không có sản phẩm nào khớp điều kiện lọc.
          </div>
        )}

        {hasRange && !salesCountQuery.isLoading && !salesCountQuery.isError && rows.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort('code')}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Mã sản phẩm {sortIcon('code')}
                    </button>
                  </TableHead>
                  <TableHead>Nhóm sản phẩm</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Tên sản phẩm {sortIcon('name')}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('salesCount')}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Lượt bán {sortIcon('salesCount')}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={salesCountQuery.isFetching ? 'opacity-60' : undefined}
                  >
                    <TableCell className="font-medium text-foreground">{row.code ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.groupName ?? row.groupCode ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.name ?? '—'}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(row.salesCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && (
              <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
                <span>
                  Trang {pagination.page}/{totalPages} — {formatCount(pagination.totalCount)} sản phẩm
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border px-3 py-1 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border px-3 py-1 disabled:opacity-40"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

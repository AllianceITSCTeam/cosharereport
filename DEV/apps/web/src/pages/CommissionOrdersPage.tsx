import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getCompaniesApi,
  getCommissionDetailApi,
  getCommissionDetailExportApi,
  getCommissionDetailItemsApi,
  getCommissionLevelsApi,
  getCommissionBeneficiariesApi,
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

const STATUS_LABEL: Record<number, string> = {
  0: 'Phiếu nháp',
  1: 'Đang xử lý',
  2: 'Thành công',
  3: 'Huỷ',
};

function formatMoney(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('vi-VN').format(n) : String(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy HH:mm');
}

function statusLabel(status: number | null): string {
  if (status === null) return '—';
  return STATUS_LABEL[status] ?? String(status);
}

function BillItemsRow({ billId, colSpan }: { billId: string; colSpan: number }) {
  const itemsQuery = useQuery({
    queryKey: ['reports', 'commission-detail-items', billId],
    queryFn: () => getCommissionDetailItemsApi(billId),
  });

  const items = itemsQuery.data ?? [];

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="bg-muted/30 p-0">
        {itemsQuery.isLoading && (
          <div className="p-3 text-xs text-muted-foreground">Đang tải mặt hàng...</div>
        )}
        {itemsQuery.isError && (
          <div className="p-3 text-xs text-destructive">Không tải được mặt hàng.</div>
        )}
        {!itemsQuery.isLoading && !itemsQuery.isError && items.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">Đơn không có mặt hàng.</div>
        )}
        {!itemsQuery.isLoading && !itemsQuery.isError && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mặt hàng</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.itemName ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.quantity)}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCell>
    </TableRow>
  );
}

export function CommissionOrdersPage() {
  const today = useMemo(() => new Date(), []);
  const [filters, setFilters, resetFilters] = useFilterState({
    key: 'report-commission-orders-filters',
    mode: 'localStorage',
    defaultValue: {
      startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
      companyId: '',
      affiliateLevelId: '',
      affiliateUserId: '',
      msnv: '',
      statusBill: '',
      productType: '',
      keyword: '',
    },
  });
  const {
    startDate,
    endDate,
    companyId,
    affiliateLevelId,
    affiliateUserId,
    msnv,
    statusBill,
    productType,
    keyword,
  } = filters;
  const range = { startDate, endDate };
  const [page, setPage] = useState(1);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;

  const hasRange = Boolean(range.startDate && range.endDate);

  const { data: companyOptions = [] } = useQuery({
    queryKey: ['reports', 'companies'],
    queryFn: getCompaniesApi,
  });

  const { data: levelOptions = [] } = useQuery({
    queryKey: ['reports', 'commission-levels'],
    queryFn: getCommissionLevelsApi,
  });

  const { data: beneficiaryOptions = [] } = useQuery({
    queryKey: ['reports', 'commission-beneficiaries', companyId, range.startDate, range.endDate],
    queryFn: () =>
      getCommissionBeneficiariesApi({ from: range.startDate, to: range.endDate, companyId: companyId || undefined }),
    enabled: hasRange,
  });

  const detailQuery = useQuery({
    queryKey: [
      'reports',
      'commission-detail',
      range.startDate,
      range.endDate,
      companyId,
      affiliateLevelId,
      affiliateUserId,
      msnv,
      statusBill,
      productType,
      keyword,
      page,
    ],
    queryFn: () =>
      getCommissionDetailApi({
        from: range.startDate,
        to: range.endDate,
        companyId: companyId || undefined,
        affiliateLevelId: affiliateLevelId || undefined,
        affiliateUserId: affiliateUserId || undefined,
        msnv: msnv || undefined,
        statusBill: statusBill ? Number(statusBill) : undefined,
        productType: productType ? (productType as 'PHYSICAL' | 'NON_PHYSICAL') : undefined,
        keyword: keyword || undefined,
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

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { blob, truncated } = await getCommissionDetailExportApi({
        from: range.startDate,
        to: range.endDate,
        companyId: companyId || undefined,
        affiliateLevelId: affiliateLevelId || undefined,
        affiliateUserId: affiliateUserId || undefined,
        msnv: msnv || undefined,
        statusBill: statusBill ? Number(statusBill) : undefined,
        productType: productType ? (productType as 'PHYSICAL' | 'NON_PHYSICAL') : undefined,
        keyword: keyword || undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-don-hang-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (truncated) {
        window.alert('Đã xuất 50.000 dòng đầu tiên. Hãy thu hẹp bộ lọc để xuất đầy đủ dữ liệu.');
      }
    } catch {
      window.alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const rows = detailQuery.data?.rows ?? [];
  const summary = detailQuery.data?.summary;
  const pagination = detailQuery.data?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize)) : 1;
  const colSpan = 9;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Báo cáo đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách chi tiết từng đơn hàng, lọc theo công ty/cấp/người hưởng/trạng thái/loại sản phẩm.
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
          <label htmlFor="company-select" className="text-xs font-medium text-muted-foreground">
            Công ty
          </label>
          <div className="relative">
            <select
              id="company-select"
              value={companyId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, companyId: e.target.value }));
                resetToFirstPage();
              }}
              className="h-11 min-w-[200px] w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-sm shadow-sm"
            >
              <option value="">— Tất cả —</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="level-select" className="text-xs font-medium text-muted-foreground">
            Cấp hệ hoa hồng
          </label>
          <div className="relative">
            <select
              id="level-select"
              value={affiliateLevelId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, affiliateLevelId: e.target.value }));
                resetToFirstPage();
              }}
              className="h-11 min-w-[180px] w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-sm shadow-sm"
            >
              <option value="">— Tất cả —</option>
              {levelOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? `Cấp ${l.levelNo}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="beneficiary-select" className="text-xs font-medium text-muted-foreground">
            Người hưởng hoa hồng
          </label>
          <div className="relative">
            <select
              id="beneficiary-select"
              value={affiliateUserId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, affiliateUserId: e.target.value }));
                resetToFirstPage();
              }}
              className="h-11 min-w-[200px] w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-sm shadow-sm"
            >
              <option value="">— Tất cả —</option>
              {beneficiaryOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status-select" className="text-xs font-medium text-muted-foreground">
            Trạng thái đơn
          </label>
          <div className="relative">
            <select
              id="status-select"
              value={statusBill}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, statusBill: e.target.value }));
                resetToFirstPage();
              }}
              className="h-11 min-w-[160px] w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-sm shadow-sm"
            >
              <option value="">— Tất cả —</option>
              <option value="0">Phiếu nháp</option>
              <option value="1">Đang xử lý</option>
              <option value="2">Thành công</option>
              <option value="3">Huỷ</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="product-type-select" className="text-xs font-medium text-muted-foreground">
            Loại sản phẩm
          </label>
          <div className="relative">
            <select
              id="product-type-select"
              value={productType}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, productType: e.target.value }));
                resetToFirstPage();
              }}
              className="h-11 min-w-[160px] w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-sm shadow-sm"
            >
              <option value="">— Tất cả —</option>
              <option value="PHYSICAL">Vật lý</option>
              <option value="NON_PHYSICAL">Phi vật lý</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="msnv-input" className="text-xs font-medium text-muted-foreground">
            MSNV
          </label>
          <input
            id="msnv-input"
            value={msnv}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, msnv: e.target.value }));
              resetToFirstPage();
            }}
            className="h-11 min-w-[140px] rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
            placeholder="MSNV người mua"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="keyword-input" className="text-xs font-medium text-muted-foreground">
            Tên / Mã đơn
          </label>
          <input
            id="keyword-input"
            value={keyword}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, keyword: e.target.value }));
              resetToFirstPage();
            }}
            className="h-11 min-w-[200px] rounded-xl border border-border/70 bg-background px-3 text-sm shadow-sm"
            placeholder="Mã đơn / người mua / người hưởng"
          />
        </div>

        <FilterActions
          onReset={handleResetFilters}
          onExport={hasRange ? handleExport : undefined}
          isExporting={isExporting}
          exportLabel="Xuất Excel"
          exportingLabel="Đang xuất..."
          testIdPrefix="orders-filter"
        />
      </div>

      {!hasRange && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Chọn khoảng ngày để xem dữ liệu.
        </div>
      )}

      {hasRange && (
        <div className="rounded-lg border bg-card">
          {detailQuery.isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>
          )}

          {detailQuery.isError && (
            <div className="p-6 text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
          )}

          {!detailQuery.isLoading && !detailQuery.isError && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Không có đơn hàng nào khớp điều kiện lọc.
            </div>
          )}

          {!detailQuery.isLoading && !detailQuery.isError && rows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Mã đơn</TableHead>
                    <TableHead>Ngày đặt</TableHead>
                    <TableHead>Người mua</TableHead>
                    <TableHead>MSNV</TableHead>
                    <TableHead>Người hưởng h.h</TableHead>
                    <TableHead className="text-right">Tổng tiền đơn</TableHead>
                    <TableHead className="text-right">Tổng tiền hoa hồng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isExpanded = expandedBillId === row.billId;
                    return (
                      <Fragment key={row.billId}>
                        <TableRow
                          className={detailQuery.isFetching ? 'opacity-60' : undefined}
                        >
                          <TableCell className="w-8">
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Thu gọn mặt hàng' : 'Xem mặt hàng'}
                              onClick={() => setExpandedBillId(isExpanded ? null : row.billId)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {row.orderCode ?? row.billId}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(row.orderDate)}</TableCell>
                          <TableCell className="text-muted-foreground">{row.buyerName ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{row.msnv ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{row.beneficiaryName ?? '—'}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatMoney(row.orderTotal)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatMoney(row.commissionAmount)}</TableCell>
                          <TableCell className="text-muted-foreground">{statusLabel(row.orderStatus)}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <BillItemsRow billId={row.billId} colSpan={colSpan} />
                        )}
                      </Fragment>
                    );
                  })}
                  {summary && (
                    <TableRow className="border-t-2 font-semibold text-foreground">
                      <TableCell colSpan={3}>
                        Tổng cộng ({formatCount(summary.totalOrders)} đơn — {formatCount(summary.successOrders)} thành công,{' '}
                        {formatCount(summary.cancelledOrders)} huỷ)
                      </TableCell>
                      <TableCell colSpan={3} />
                      <TableCell className="text-right">{formatMoney(summary.sumOrderTotal)}</TableCell>
                      <TableCell className="text-right">{formatMoney(summary.sumCommission)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {pagination && (
                <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
                  <span>
                    Trang {pagination.page}/{totalPages} — {formatCount(pagination.totalCount)} đơn
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
      )}
    </div>
  );
}

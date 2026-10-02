import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import {
  getMerchantProductGroupsApi,
  getMerchantProductsApi,
  type MerchantProductStatus,
} from '@/api/reports.api';
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

const STATUS_LABEL: Record<MerchantProductStatus, string> = {
  SELLING: 'Đang bán',
  OUT_OF_STOCK: 'Hết hàng',
  HIDDEN: 'Đã ẩn',
};

function formatCount(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function MerchantProductsPage() {
  const [filters, setFilters, resetFilters] = useFilterState({
    key: 'report-merchant-products-filters',
    mode: 'localStorage',
    defaultValue: {
      code: '',
      name: '',
      groupProductId: '',
      status: '',
    },
  });
  const { code, name, groupProductId, status } = filters;
  // Gõ liên tục không gọi API ngay mỗi phím — tránh dồn request gây ThrottlerException (429).
  const debouncedCode = useDebounce(code, 300);
  const debouncedName = useDebounce(name, 300);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: groupOptions = [] } = useQuery({
    queryKey: ['reports', 'merchant-product-groups'],
    queryFn: getMerchantProductGroupsApi,
  });

  const productsQuery = useQuery({
    queryKey: ['reports', 'merchant-products', debouncedCode, debouncedName, groupProductId, status, page],
    queryFn: () =>
      getMerchantProductsApi({
        code: debouncedCode || undefined,
        name: debouncedName || undefined,
        groupProductId: groupProductId || undefined,
        status: status ? (status as MerchantProductStatus) : undefined,
        page,
        pageSize,
      }),
  });

  const resetToFirstPage = () => setPage(1);

  const handleResetFilters = () => {
    resetFilters();
    resetToFirstPage();
  };

  const rows = productsQuery.data?.rows ?? [];
  const pagination = productsQuery.data?.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hàng hóa trên website</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách sản phẩm, lọc theo mã/tên/nhóm hàng/trạng thái.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
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

        <div className="flex flex-col gap-1">
          <label htmlFor="status-select" className="text-xs font-medium text-muted-foreground">
            Trạng thái
          </label>
          <SearchableSelect
            id="status-select"
            className="min-w-[160px]"
            searchable={false}
            value={status}
            onChange={(next) => {
              setFilters((prev) => ({ ...prev, status: next }));
              resetToFirstPage();
            }}
            options={[
              { value: 'SELLING', label: 'Đang bán' },
              { value: 'OUT_OF_STOCK', label: 'Hết hàng' },
              { value: 'HIDDEN', label: 'Đã ẩn' },
            ]}
          />
        </div>

        <FilterActions onReset={handleResetFilters} testIdPrefix="merchant-products-filter" />
      </div>

      <div className="rounded-lg border bg-card">
        {productsQuery.isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>
        )}

        {productsQuery.isError && (
          <div className="p-6 text-sm text-destructive">Không tải được dữ liệu báo cáo.</div>
        )}

        {!productsQuery.isLoading && !productsQuery.isError && rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            Không có sản phẩm nào khớp điều kiện lọc.
          </div>
        )}

        {!productsQuery.isLoading && !productsQuery.isError && rows.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã sản phẩm</TableHead>
                  <TableHead>Nhóm sản phẩm</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={productsQuery.isFetching ? 'opacity-60' : undefined}
                  >
                    <TableCell className="font-medium text-foreground">{row.code ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.groupName ?? row.groupCode ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{STATUS_LABEL[row.status]}</TableCell>
                    <TableCell>
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Xem <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
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

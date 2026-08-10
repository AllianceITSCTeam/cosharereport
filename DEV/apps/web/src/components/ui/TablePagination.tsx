import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  resourceName?: string; // e.g. "employees", "items" for "Showing 1-20 of 142 employees"
  onPageChange: (page: number) => void;
  className?: string;
  testId?: string;
}

/**
 * Unified pagination footer for all tables.
 * Shows prev/next buttons, up to 7 page number pills, and a jump-to-page input.
 */
export function TablePagination({ page, totalPages, total, limit = 20, resourceName, onPageChange, className, testId }: TablePaginationProps) {
  const [jumpValue, setJumpValue] = useState('');

  useEffect(() => { setJumpValue(''); }, [page]);

  if (totalPages <= 1 && !total) return null;

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(jumpValue);
    if (n >= 1 && n <= totalPages) onPageChange(n);
  }

  const pages = buildPageNumbers(page, totalPages);
  // Calculate "from" and "to" for "Showing X-Y of Z" format (BA Convention 3.1)
  const from = total ? (page - 1) * limit + 1 : 1;
  const to = total ? Math.min(page * limit, total) : limit;
  const resourceLabel = resourceName ? ` ${resourceName}` : '';

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground mt-2 px-4 pb-4 pt-3 border-t ${className ?? ''}`}>
      {total !== undefined ? (
        <span className="shrink-0">Showing {from}-{to} of {total}{resourceLabel}</span>
      ) : (
        <span className="shrink-0">Page {page} of {totalPages}</span>
      )}

      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button
          data-testid={testId ? `${testId}-prev` : undefined}
          variant="outline"
          size="sm"
          className="h-7 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </Button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 select-none">…</span>
          ) : (
            <Button
              key={p}
              data-testid={testId ? `${testId}-page-${p}` : undefined}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          data-testid={testId ? `${testId}-next` : undefined}
          variant="outline"
          size="sm"
          className="h-7 px-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </Button>
      </div>

      {totalPages > 5 && (
        <form onSubmit={handleJump} className="flex items-center gap-1 shrink-0">
          <span className="text-xs">Go to</span>
          <Input
            data-testid={testId ? `${testId}-jump-input` : undefined}
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            className="h-7 w-14 text-xs text-center"
          />
          <Button data-testid={testId ? `${testId}-jump-go` : undefined} type="submit" variant="outline" size="sm" className="h-7 px-2 text-xs">Go</Button>
        </form>
      )}
    </div>
  );
}

/** Build a list of page numbers with ellipsis, e.g. [1, '…', 4, 5, 6, '…', 20] */
function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '…')[] = [];

  pages.push(1);
  if (current > 3) pages.push('…');

  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }

  if (current < total - 2) pages.push('…');
  pages.push(total);

  return pages;
}

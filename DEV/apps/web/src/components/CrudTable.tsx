import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { TablePagination } from '@/components/ui/TablePagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Eye, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export interface IPaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CrudTableProps<T extends object> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  pagination?: IPaginationState;
  resourceName?: string; // e.g. "employees" for pagination text
  onAdd?: () => void;
  onView?: (row: T) => void;
  viewIcon?: React.ReactNode;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onSearch?: (value: string) => void;
  onPageChange?: (page: number) => void;
  onSortChange?: (sortBy: string | undefined, sortDir: 'asc' | 'desc') => void;
  addLabel?: string;
  showSearch?: boolean;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getDeleteTargetLabel<T extends object>(target: T | null): string {
  if (!target) {
    return 'this record';
  }

  const record = toRecord(target);
  if (!record) {
    return 'this record';
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (name) {
    return name;
  }

  const displayName = typeof record.displayName === 'string' ? record.displayName.trim() : '';
  if (displayName) {
    return displayName;
  }

  const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const surname = typeof record.surname === 'string' ? record.surname.trim() : '';
  const fullName = [firstName, surname].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  const code = typeof record.code === 'string' ? record.code.trim() : '';
  if (code) {
    return code;
  }

  return 'this record';
}

export function CrudTable<T extends object>({
  columns,
  data,
  isLoading,
  pagination,
  resourceName,
  onAdd,
  onView,
  viewIcon,
  onEdit,
  onDelete,
  onSearch,
  onPageChange,
  onSortChange,
  addLabel = 'Add',
  showSearch = true,
}: CrudTableProps<T>) {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const deleteTargetLabel = getDeleteTargetLabel(deleteTarget);

  const allColumns: ColumnDef<T>[] = [
    ...columns,
    {
      id: '_actions',
      header: 'Actions',
      enableSorting: false,
      size: 10,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(row.original)}
              title="View details"
            >
              {viewIcon ?? <Eye className="h-4 w-4" />}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row.original)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Client-side filter when no server-side onSearch is wired up
  const table = useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: !!pagination,
    manualSorting: !!onSortChange,
    pageCount: pagination?.totalPages ?? -1,
    state: { globalFilter: onSearch ? undefined : search, sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      if (onSortChange) {
        if (next.length === 0) {
          onSortChange(undefined, 'asc');
        } else {
          onSortChange(next[0].id, next[0].desc ? 'desc' : 'asc');
        }
      }
    },
    sortDescFirst: true,
    globalFilterFn: 'includesString',
  });

  function handleSearchChange(value: string) {
    setSearch(value);
    onSearch?.(value);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {showSearch && (
          <Input
            data-testid="crud-search"
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full sm:max-w-xs"
          />
        )}
        {onAdd && (
          <Button data-testid="crud-add-btn" onClick={onAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground shadow-sm">
            Loading...
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground shadow-sm">
            No records found.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => (
            <div key={row.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3 overflow-hidden">
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as { mobileHidden?: boolean } | undefined;
                if (meta?.mobileHidden) {
                  return null;
                }

                const header = cell.column.columnDef.header;
                const headerText = typeof header === 'string' ? header : cell.column.id;
                
                if (headerText === '_actions') {
                  return (
                    <div key={cell.id} className="pt-3 mt-1 border-t flex justify-end">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                }
                
                return (
                  <div key={cell.id} className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      {headerText}
                    </span>
                    <div className="text-sm font-medium text-right break-words overflow-hidden text-ellipsis">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-x-auto bg-card">
        <Table data-testid="crud-table" className="table-fixed w-full">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={canSort ? 'cursor-pointer select-none' : ''}
                      style={header.column.columnDef.size !== undefined ? { width: `${header.column.columnDef.size}%` } : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === 'asc' ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                            : sorted === 'desc' ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            : <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <TablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          resourceName={resourceName}
          onPageChange={(p) => onPageChange?.(p)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete record"
        description={`Are you sure you want to delete "${deleteTargetLabel}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (!deleteTarget || !onDelete) return;
          onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

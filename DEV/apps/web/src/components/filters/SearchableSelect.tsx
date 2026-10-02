import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (next: string) => void;
  options: SearchableSelectOption[];
  allLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
  /** false ẩn ô tìm kiếm — dùng khi danh sách option ngắn, chỉ cần style dropdown đồng bộ (default true). */
  searchable?: boolean;
}

/** Dropdown đồng bộ style — có ô tìm kiếm lọc option theo tên khi danh sách dài (vd: nhóm hàng),
 * hoặc chỉ dropdown thường khi `searchable={false}` (vd: trạng thái, danh sách ngắn). */
export function SearchableSelect({
  value,
  onChange,
  options,
  allLabel = '— Tất cả —',
  placeholder = 'Tìm...',
  searchPlaceholder,
  className,
  id,
  searchable = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? allLabel;

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    if (searchable) searchInputRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, searchable]);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((prev) => !prev)}
        className="h-11 w-full appearance-none rounded-xl border border-border/70 bg-background pl-3 pr-9 text-left text-sm shadow-sm"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{selectedLabel}</span>
      </button>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border/70 bg-background shadow-lg">
          {searchable && (
            <div className="relative border-b border-border/70 p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? placeholder}
                className="h-9 w-full rounded-lg border border-transparent bg-muted/40 pl-8 pr-2 text-sm outline-none focus:border-border/70"
              />
            </div>
          )}
          <ul className="max-h-60 overflow-auto py-1 text-sm">
            <li>
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
              >
                {allLabel}
                {value === '' && <Check className="h-4 w-4" />}
              </button>
            </li>
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">Không tìm thấy kết quả.</li>
            )}
            {filteredOptions.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                >
                  <span>{o.label}</span>
                  {value === o.value && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

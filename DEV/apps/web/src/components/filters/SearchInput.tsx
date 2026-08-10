import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  onEnter?: () => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export function SearchInput({
  value,
  onChange,
  onEnter,
  debounceMs = 0,
  placeholder = 'Search...',
  className,
  testId,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  // Stable ref so the debounce closure always fires the latest onChange/onEnter
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);

  // Sync external value changes into local state (e.g. after reset)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const id = setTimeout(() => {
      onChangeRef.current(local);
    }, debounceMs);
    return () => clearTimeout(id);
  }, [local, debounceMs]);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          if (debounceMs <= 0) onChangeRef.current(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnterRef.current) {
            e.preventDefault();
            onEnterRef.current();
          }
        }}
        placeholder={placeholder}
        className="pl-8"
        data-testid={testId}
      />
    </div>
  );
}

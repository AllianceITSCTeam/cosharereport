import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Globe, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All supported IANA timezone IDs, resolved to canonical names (browser-native, no extra package). */
const ALL_TIMEZONES: string[] = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (Intl as any).supportedValuesOf('timeZone') as string[];
    // resolvedOptions().timeZone maps deprecated aliases (e.g. Asia/Saigon) to canonical
    // names (e.g. Asia/Ho_Chi_Minh) that PostgreSQL recognizes. Deduplicate after mapping.
    const seen = new Set<string>();
    const canonical: string[] = [];
    for (const tz of raw) {
      try {
        const name = Intl.DateTimeFormat(undefined, { timeZone: tz }).resolvedOptions().timeZone;
        if (!seen.has(name)) {
          seen.add(name);
          canonical.push(name);
        }
      } catch {
        // skip unrecognized entries
      }
    }
    return canonical;
  } catch {
    return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Ho_Chi_Minh', 'Asia/Manila', 'Australia/Sydney'];
  }
})();

function getUtcOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    // "GMT" → "UTC+0", "GMT+7" → "UTC+7"
    return raw.replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

function getRegion(tz: string): string {
  return tz.includes('/') ? tz.split('/')[0] : 'Other';
}

function resolveCanonical(tz: string): string {
  try {
    return Intl.DateTimeFormat(undefined, { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return tz;
  }
}

function formatLabel(tz: string): string {
  const offset = getUtcOffset(tz);
  const name = tz.replace(/_/g, ' ');
  return offset ? `${name} (${offset})` : name;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimezoneSelectProps {
  value?: string | null;
  onChange: (tz: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TimezoneSelect({
  value,
  onChange,
  placeholder = 'Select timezone…',
  className,
  disabled = false,
}: TimezoneSelectProps) {
  // Resolve deprecated aliases (e.g. Asia/Saigon → Asia/Ho_Chi_Minh) for display and matching
  const displayValue = value ? resolveCanonical(value) : undefined;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? ALL_TIMEZONES.filter((tz) => {
          const normalized = tz.replace(/_/g, ' ').toLowerCase();
          return normalized.includes(q) || getUtcOffset(tz).toLowerCase().includes(q);
        })
      : ALL_TIMEZONES;

    const map = new Map<string, string[]>();
    for (const tz of filtered) {
      const region = getRegion(tz);
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(tz);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [search]);

  const totalCount = grouped.reduce((acc, [, items]) => acc + items.length, 0);

  function handleSelect(tz: string) {
    onChange(tz);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        data-testid="timezone-select"
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {displayValue ? formatLabel(displayValue) : placeholder}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </span>
      </button>

      {/* Picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Select Timezone
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-4 py-3 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search timezone or offset…"
                className="pl-9"
              />
            </div>
            {totalCount === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No timezones match.</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">{totalCount} timezone{totalCount !== 1 ? 's' : ''}</p>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 px-1 py-1">
            {grouped.map(([region, timezones]) => (
              <div key={region}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 bg-background/95">
                  {region}
                </div>
                {timezones.map((tz) => (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => handleSelect(tz)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-sm text-sm text-left',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus:outline-none focus:bg-accent focus:text-accent-foreground',
                      displayValue === tz && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <span className="truncate">{tz.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {getUtcOffset(tz)}
                    </span>
                    {displayValue === tz && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t shrink-0 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

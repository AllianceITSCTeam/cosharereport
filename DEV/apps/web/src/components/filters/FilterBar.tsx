import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
  activeCount?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  testId?: string;
}

export function FilterBar({
  children,
  actions,
  title = 'Filters',
  activeCount,
  collapsible = false,
  defaultCollapsed = false,
  className,
  testId,
}: FilterBarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={cn('rounded-lg border border-border p-4 space-y-4', className)}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {activeCount ? (
            <Badge
              variant="secondary"
              data-testid={testId ? `${testId}-active-count` : undefined}
            >
              {activeCount} active
            </Badge>
          ) : null}
        </div>
        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {!collapsed && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">{children}</div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </>
      )}
    </div>
  );
}

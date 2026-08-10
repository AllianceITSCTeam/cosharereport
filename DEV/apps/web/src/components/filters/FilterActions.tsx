import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilterActionsProps {
  onSearch?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  isSearching?: boolean;
  searchLabel?: string;
  resetLabel?: string;
  exportLabel?: string;
  extra?: React.ReactNode;
  testIdPrefix?: string;
}

export function FilterActions({
  onSearch,
  onReset,
  onExport,
  isExporting,
  isSearching,
  searchLabel = 'Search',
  resetLabel = 'Reset',
  exportLabel = 'Export Excel',
  extra,
  testIdPrefix,
}: FilterActionsProps) {
  const tid = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

  return (
    <>
      {extra}
      {onSearch && (
        <Button
          size="sm"
          onClick={onSearch}
          disabled={isSearching}
          data-testid={tid('search')}
        >
          {isSearching ? 'Searching...' : searchLabel}
        </Button>
      )}
      {onReset && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReset}
          data-testid={tid('reset')}
        >
          {resetLabel}
        </Button>
      )}
      {onExport && (
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={isExporting}
          data-testid={tid('export')}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : exportLabel}
        </Button>
      )}
    </>
  );
}

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
  exportingLabel?: string;
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
  exportingLabel = 'Exporting...',
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
          className="h-11"
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
          className="h-11"
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
          className="h-11"
          variant="outline"
          onClick={onExport}
          disabled={isExporting}
          data-testid={tid('export')}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? exportingLabel : exportLabel}
        </Button>
      )}
    </>
  );
}

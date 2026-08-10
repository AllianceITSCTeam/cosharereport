import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FilterFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  testId?: string;
}

export function FilterField({ label, htmlFor, hint, className, children, testId }: FilterFieldProps) {
  return (
    <div className={cn('space-y-1', className)} data-testid={testId}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export interface SimpleBarChartRow {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: SimpleBarChartRow[];
  formatValue?: (value: number) => string;
}

/**
 * Dependency-free horizontal bar chart — no chart library is installed in this app yet
 * (see SimplePieChart.tsx), so this follows the same hand-rolled convention.
 */
export function SimpleBarChart({ data, formatValue = String }: SimpleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="space-y-3">
      {data.map((d, index) => (
        <li key={`${d.label}-${index}`} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{d.label}</span>
            <span className="shrink-0 font-medium text-foreground">{formatValue(d.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

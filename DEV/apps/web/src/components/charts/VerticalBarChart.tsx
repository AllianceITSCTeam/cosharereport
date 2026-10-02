import { useRef, useState } from 'react';

export interface VerticalBarChartRow {
  label: string;
  value: number;
}

interface VerticalBarChartProps {
  data: VerticalBarChartRow[];
  formatValue?: (value: number) => string;
}

interface HoverState {
  row: VerticalBarChartRow;
  x: number;
  y: number;
}

/**
 * Dependency-free column chart — same hand-rolled convention as SimpleBarChart
 * (horizontal), used where a vertical layout reads better for dashboard variety.
 * Hovering a column shows a small tooltip with that column's label/value, same
 * convention as SimplePieChart.
 */
export function VerticalBarChart({ data, formatValue = String }: VerticalBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  function updateHover(e: React.MouseEvent<HTMLDivElement>, row: VerticalBarChartRow) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ row, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-36 items-end gap-3">
        {data.map((d, index) => (
          <div
            key={`${d.label}-${index}`}
            className="flex h-full flex-1 flex-col items-center justify-end"
          >
            <span className="mb-1 text-xs font-medium text-foreground">{formatValue(d.value)}</span>
            <div
              className="w-full cursor-pointer rounded-t-md bg-primary transition-opacity hover:opacity-80"
              style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
              onMouseEnter={(e) => updateHover(e, d)}
              onMouseMove={(e) => updateHover(e, d)}
              onMouseLeave={() => setHover(null)}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {data.map((d, index) => (
          <span
            key={`${d.label}-${index}`}
            className="flex-1 truncate text-center text-xs text-muted-foreground"
            title={d.label}
          >
            {d.label}
          </span>
        ))}
      </div>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <div className="font-medium text-foreground">{hover.row.label}</div>
          <div className="text-muted-foreground">{formatValue(hover.row.value)}</div>
        </div>
      )}
    </div>
  );
}

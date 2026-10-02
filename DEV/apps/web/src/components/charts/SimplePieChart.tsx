import { useRef, useState } from 'react';

export interface SimplePieChartSlice {
  label: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: SimplePieChartSlice[];
  size?: number;
  formatValue?: (value: number) => string;
}

interface HoverState {
  slice: SimplePieChartSlice;
  x: number;
  y: number;
}

/**
 * Dependency-free SVG pie chart — no chart library is installed in this app yet
 * and the slice count here is small (AffiliateLevel has 3 tiers), so a hand-rolled
 * SVG avoids pulling in a new package for one chart. Hovering a slice shows a
 * small tooltip with that slice's legend entry (label/value/%).
 */
export function SimplePieChart({ data, size = 220, formatValue = String }: SimplePieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;

  let cumulativeAngle = -90; // start at 12 o'clock

  function toXY(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return [radius + radius * Math.cos(rad), radius + radius * Math.sin(rad)];
  }

  const slices = total > 0
    ? data
        .filter((d) => d.value > 0)
        .map((d) => {
          const angle = (d.value / total) * 360;
          const startAngle = cumulativeAngle;
          const endAngle = cumulativeAngle + angle;
          cumulativeAngle = endAngle;

          const [x1, y1] = toXY(startAngle);
          const [x2, y2] = toXY(endAngle);
          const largeArc = angle > 180 ? 1 : 0;

          const path =
            angle >= 359.99
              ? `M ${radius - radius} ${radius} A ${radius} ${radius} 0 1 1 ${radius + radius - 0.01} ${radius} Z`
              : `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

          return { ...d, path };
        })
    : [];

  function updateHover(e: React.MouseEvent<SVGPathElement>, slice: SimplePieChartSlice) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ slice, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
        {total === 0 ? (
          <circle cx={radius} cy={radius} r={radius - 1} className="fill-muted" />
        ) : (
          slices.map((s) => (
            <path
              key={s.label}
              d={s.path}
              fill={s.color}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onMouseEnter={(e) => updateHover(e, s)}
              onMouseMove={(e) => updateHover(e, s)}
              onMouseLeave={() => setHover(null)}
            />
          ))
        )}
      </svg>
      <ul className="space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-foreground">{d.label}</span>
            <span className="text-muted-foreground">
              {formatValue(d.value)}
              {total > 0 && ` (${((d.value / total) * 100).toFixed(1)}%)`}
            </span>
          </li>
        ))}
      </ul>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: hover.slice.color }} />
            {hover.slice.label}
          </div>
          <div className="text-muted-foreground">
            {formatValue(hover.slice.value)}
            {total > 0 && ` (${((hover.slice.value / total) * 100).toFixed(1)}%)`}
          </div>
        </div>
      )}
    </div>
  );
}

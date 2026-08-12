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

/**
 * Dependency-free SVG pie chart — no chart library is installed in this app yet
 * and the slice count here is small (AffiliateLevel has 3 tiers), so a hand-rolled
 * SVG avoids pulling in a new package for one chart.
 */
export function SimplePieChart({ data, size = 220, formatValue = String }: SimplePieChartProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Pie chart">
        {total === 0 ? (
          <circle cx={radius} cy={radius} r={radius - 1} className="fill-muted" />
        ) : (
          slices.map((s) => <path key={s.label} d={s.path} fill={s.color} />)
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
    </div>
  );
}

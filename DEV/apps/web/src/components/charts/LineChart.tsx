export interface LineChartPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartPoint[];
  formatValue?: (value: number) => string;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING_X = 32;
const PADDING_TOP = 26;
const PADDING_BOTTOM = 22;

/**
 * Dependency-free SVG line chart for a short trend (few points) — same
 * hand-rolled convention as SimpleBarChart/SimplePieChart. Direct value labels
 * instead of a hover tooltip, consistent with the other dashboard charts.
 * The first/last labels anchor to start/end (not "middle") so they don't get
 * clipped by the SVG viewBox — a plain centered anchor pushes half the text
 * for the edge points outside the 0..WIDTH box.
 */
export function LineChart({ data, formatValue = String }: LineChartProps) {
  const innerWidth = WIDTH - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: PADDING_X + stepX * i,
    y: PADDING_TOP + innerHeight * (1 - d.value / max),
    anchor: i === 0 ? ('start' as const) : i === data.length - 1 ? ('end' as const) : ('middle' as const),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const baselineY = PADDING_TOP + innerHeight;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ overflow: 'visible' }}
      role="img"
      aria-label="Line chart"
    >
      <line x1={PADDING_X} y1={baselineY} x2={WIDTH - PADDING_X} y2={baselineY} className="stroke-border" strokeWidth={1} />
      {points.length > 1 && (
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={3.5} className="fill-primary" />
          <text x={p.x} y={Math.max(p.y - 8, 10)} textAnchor={p.anchor} className="fill-foreground text-[9px] font-medium">
            {formatValue(p.value)}
          </text>
          <text x={p.x} y={HEIGHT - 6} textAnchor={p.anchor} className="fill-muted-foreground text-[9px]">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

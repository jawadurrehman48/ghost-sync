export interface BarSeries {
  key: string;
  /** Legend text (always shown, so colour is never the only signal). */
  label: string;
  /** SVG fill class for the bars, e.g. "fill-red-600". */
  barClassName: string;
  /** Background class for the legend swatch, e.g. "bg-red-600". */
  swatchClassName: string;
}

export interface BarGroup {
  /** Shown under the group when there is room, e.g. "15/03". */
  label: string;
  /** One value per series, same order as `series`. Negative values count as 0. */
  values: number[];
}

export interface GroupedBarChartProps {
  series: BarSeries[];
  groups: BarGroup[];
  /** Short accessible name, e.g. "Credit given and payments received per day". */
  ariaLabel: string;
  /** Longer text for screen readers, e.g. the totals. */
  description?: string;
  /** Chart height in SVG units (width is fixed at 320 and scales to the screen). */
  height?: number;
}

const WIDTH = 320;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;

/**
 * A small dependency-free SVG bar chart with several bars per group.
 * It scales to the container width, never produces NaN (empty or all-zero
 * data is fine), thins its x-axis labels to fit, and stays left-to-right even
 * inside right-to-left pages so dates and numbers read correctly.
 */
export function GroupedBarChart({ series, groups, ariaLabel, description, height = 160 }: GroupedBarChartProps) {
  if (groups.length === 0 || series.length === 0) return null;

  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotHeight;
  const groupWidth = plotWidth / groups.length;
  const gap = 1;
  const barWidth = Math.max(1, Math.min(16, (groupWidth * 0.8 - gap * (series.length - 1)) / series.length));
  const clusterWidth = barWidth * series.length + gap * (series.length - 1);
  const maxValue = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0))));
  const labelStep = Math.ceil(groups.length / 6);

  return (
    <div dir="ltr">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={PAD_X} x2={WIDTH - PAD_X} y1={baseline} y2={baseline} className="stroke-gray-300" strokeWidth="1" />
        {groups.map((group, i) => {
          const groupStart = PAD_X + i * groupWidth;
          const clusterStart = groupStart + (groupWidth - clusterWidth) / 2;
          return (
            <g key={`${group.label}-${i}`}>
              {series.map((s, j) => {
                const raw = group.values[j] ?? 0;
                const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                if (value === 0) return null;
                const barHeight = Math.max(1, (value / maxValue) * plotHeight);
                return (
                  <rect
                    key={s.key}
                    x={clusterStart + j * (barWidth + gap)}
                    y={baseline - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx="1"
                    className={s.barClassName}
                  />
                );
              })}
              {i % labelStep === 0 ? (
                // Edge labels are anchored inwards so they are never clipped by the chart border.
                <text
                  x={i === 0 ? PAD_X : i === groups.length - 1 ? WIDTH - PAD_X : groupStart + groupWidth / 2}
                  y={height - 6}
                  textAnchor={i === 0 ? 'start' : i === groups.length - 1 ? 'end' : 'middle'}
                  fontSize="10"
                  className="fill-gray-600"
                >
                  {group.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {description ? <p className="sr-only">{description}</p> : null}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm ${s.swatchClassName}`} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

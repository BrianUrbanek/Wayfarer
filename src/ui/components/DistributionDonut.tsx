import type { DistributionSlice } from '../summaryVisuals';

interface DistributionDonutProps {
  slices: DistributionSlice[];
}

const COLORS = ['#73e2a7', '#8da4ff', '#ffd36f', '#ff8b8b', '#96d9ff'];

export function DistributionDonut({ slices }: DistributionDonutProps) {
  const radius = 46;
  const stroke = 18;
  const normalized = slices.reduce((sum, slice) => sum + slice.score, 0) || 1;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg className="distribution-donut" viewBox="0 0 120 120" role="img" aria-label="Distribution donut chart">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      {slices.map((slice, index) => {
        const pct = slice.score / normalized;
        const len = pct * circumference;
        const dash = `${len} ${circumference - len}`;
        const part = (
          <circle
            key={`${slice.label}-${index}`}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset += len;
        return part;
      })}
    </svg>
  );
}

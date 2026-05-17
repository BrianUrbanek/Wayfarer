import type { DistributionSlice } from '../summaryVisuals';

interface DistributionLegendProps {
  slices: DistributionSlice[];
  formatPercent: (value: number) => string;
}

const COLORS = ['#73e2a7', '#8da4ff', '#ffd36f', '#ff8b8b', '#96d9ff'];

export function DistributionLegend({ slices, formatPercent }: DistributionLegendProps) {
  return (
    <ul className="distribution-legend">
      {slices.map((slice, index) => (
        <li key={`${slice.label}-${index}`} className="distribution-legend__item">
          <span className="distribution-legend__dot" style={{ background: COLORS[index % COLORS.length] }} aria-hidden="true" />
          <span className="distribution-legend__label">{slice.label}</span>
          <span className="distribution-legend__score">{formatPercent(slice.score)} distribution share</span>
        </li>
      ))}
    </ul>
  );
}

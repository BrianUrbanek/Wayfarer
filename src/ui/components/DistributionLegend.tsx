import type { DistributionSlice } from '../summaryVisuals';
import { DISTRIBUTION_COLORS } from './distributionPalette';

interface DistributionLegendProps {
  slices: DistributionSlice[];
  formatPercent: (value: number) => string;
}

export function DistributionLegend({ slices, formatPercent }: DistributionLegendProps) {
  return (
    <ul className="distribution-legend">
      {slices.map((slice, index) => (
        <li key={`${slice.label}-${index}`} className="distribution-legend__item">
          <span className="distribution-legend__dot" style={{ background: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length] }} aria-hidden="true" />
          <span className="distribution-legend__label">{slice.label}</span>
          <span className="distribution-legend__score">{formatPercent(slice.score)} distribution share</span>
        </li>
      ))}
    </ul>
  );
}

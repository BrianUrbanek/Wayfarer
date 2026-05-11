import type { PropsWithChildren, ReactNode } from 'react';

interface MetricCardProps extends PropsWithChildren {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}

export function MetricCard({ label, value, helper, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {helper ? <div className="metric-card__helper">{helper}</div> : null}
    </article>
  );
}

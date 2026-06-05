import type { PropsWithChildren, ReactNode } from 'react';
import { InfoTip } from './InfoTip';

export interface MetricCardProps extends PropsWithChildren {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  explanation?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  labelTitle?: string;
  valueTitle?: string;
  helperTitle?: string;
}

export function MetricCard({ label, value, helper, explanation, tone = 'neutral', labelTitle, valueTitle, helperTitle }: MetricCardProps) {
  const valueIsPlainText = typeof value === 'string' || typeof value === 'number';

  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__label-row">
        <div className="metric-card__label" title={labelTitle ?? label}>
          {label}
        </div>
        {explanation ? <InfoTip label={`${label} explanation`} text={explanation} title={label} /> : null}
      </div>
      <div
        className={`metric-card__value${valueIsPlainText ? ' metric-card__value--text' : ''}`}
        title={valueTitle ?? (valueIsPlainText ? String(value) : undefined)}
      >
        {value}
      </div>
      {helper ? (
        <div className="metric-card__helper" title={helperTitle ?? (typeof helper === 'string' ? helper : undefined)}>
          {helper}
        </div>
      ) : null}
    </article>
  );
}

import { useMemo, useState } from 'react';
import { Panel } from './Panel';
import type { SystemHealthSummary } from '../systemHealth';
import { SYSTEM_HEALTH_FORMULA_AUDIT, SYSTEM_HEALTH_FORMULA_SPEC, sumFormulaWeights } from '../systemHealthFormulas';

interface ConfidenceSeriesState {
  player: boolean;
  island: boolean;
  cohort: boolean;
  tag: boolean;
}

interface SystemHealthPanelProps {
  summary: SystemHealthSummary;
  showConfidenceSeries: ConfidenceSeriesState;
  onToggleSeries: (key: keyof ConfidenceSeriesState) => void;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number, digits = 1): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function buildLinePath(values: number[], width: number, height: number, padding: number): string {
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);
  if (values.length === 0) {
    return '';
  }

  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = padding + (index * stepX);
      const y = padding + (innerHeight - (Math.max(0, Math.min(1, value)) * innerHeight));
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function SystemHealthPanel({ summary, showConfidenceSeries, onToggleSeries }: SystemHealthPanelProps) {
  const [showFormulaAudit, setShowFormulaAudit] = useState(false);

  const trendLines = useMemo(
    () => ({
      system: buildLinePath(summary.trend.map((point) => point.systemConfidence), 760, 220, 16),
      player: buildLinePath(summary.trend.map((point) => point.playerConfidence), 760, 220, 16),
      island: buildLinePath(summary.trend.map((point) => point.islandConfidence), 760, 220, 16),
      cohort: buildLinePath(summary.trend.map((point) => point.cohortConfidence), 760, 220, 16),
      tag: buildLinePath(summary.trend.map((point) => point.tagConfidence), 760, 220, 16)
    }),
    [summary.trend]
  );

  return (
    <Panel title="System Health" className="panel--full">
      <div className="system-confidence-header">
        <div className="system-confidence-header__headline">
          <p className="eyebrow">System coverage</p>
          <h3 className="system-confidence-header__value">{formatPercent(summary.systemCoverage)}</h3>
          <p className="muted">{formatSigned(summary.coverageDelta * 100)} pts over this run.</p>
          <p className="muted">
            System confidence: {formatPercent(summary.systemConfidence)} ({formatSigned(summary.confidenceDelta * 100)} pts)
          </p>
        </div>
        <aside className="system-confidence-header__howto" aria-label="How to read system health">
          <p className="muted">
            Coverage tracks evidence spread across players, islands, cohorts, and tags. Confidence tracks whether those
            patterns are coherent and trustworthy given available evidence.
          </p>
        </aside>
      </div>

      <div className="system-confidence-cards">
        <button
          type="button"
          className={`metric-card system-confidence-card${showConfidenceSeries.player ? ' system-confidence-card--active' : ''}`}
          aria-pressed={showConfidenceSeries.player}
          onClick={() => onToggleSeries('player')}
        >
          <div className="system-confidence-card__state-dot" aria-hidden="true">{showConfidenceSeries.player ? '?' : '?'}</div>
          <div className="metric-card__label">Player Confidence</div>
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.playerConfidence)}</div>
          <div className="metric-card__helper">Mismatch/inverse profiles can still be high-confidence.</div>
        </button>
        <button
          type="button"
          className={`metric-card system-confidence-card${showConfidenceSeries.island ? ' system-confidence-card--active' : ''}`}
          aria-pressed={showConfidenceSeries.island}
          onClick={() => onToggleSeries('island')}
        >
          <div className="system-confidence-card__state-dot" aria-hidden="true">{showConfidenceSeries.island ? '?' : '?'}</div>
          <div className="metric-card__label">Island Confidence</div>
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.islandConfidence)}</div>
          <div className="metric-card__helper">Island affinity confidence with evidence weighting.</div>
        </button>
        <button
          type="button"
          className={`metric-card system-confidence-card${showConfidenceSeries.cohort ? ' system-confidence-card--active' : ''}`}
          aria-pressed={showConfidenceSeries.cohort}
          onClick={() => onToggleSeries('cohort')}
        >
          <div className="system-confidence-card__state-dot" aria-hidden="true">{showConfidenceSeries.cohort ? '?' : '?'}</div>
          <div className="metric-card__label">Cohort Confidence</div>
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.cohortConfidence)}</div>
          <div className="metric-card__helper">Cohort usefulness as explanatory structure.</div>
        </button>
        <button
          type="button"
          className={`metric-card system-confidence-card${showConfidenceSeries.tag ? ' system-confidence-card--active' : ''}`}
          aria-pressed={showConfidenceSeries.tag}
          onClick={() => onToggleSeries('tag')}
        >
          <div className="system-confidence-card__state-dot" aria-hidden="true">{showConfidenceSeries.tag ? '?' : '?'}</div>
          <div className="metric-card__label">Tag Confidence</div>
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.tagConfidence)}</div>
          <div className="metric-card__helper">Approximate proxy. Toggle tag confidence series.</div>
        </button>
      </div>

      <div className="system-confidence-trend">
        <div className="system-confidence-trend__legend">
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--system">
            System Confidence (always shown)
          </span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--player">Player</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--island">Island</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--cohort">Cohort</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--tag">Tag</span>
        </div>
        <svg viewBox="0 0 760 220" role="img" aria-label="System confidence over time">
          <rect x="0" y="0" width="760" height="220" className="system-confidence-trend__bg" />
          {[0, 0.5, 1].map((tick) => (
            <g key={tick}>
              <line x1="48" y1={16 + (1 - tick) * 176} x2="744" y2={16 + (1 - tick) * 176} className="system-confidence-trend__grid" />
              <text x="8" y={20 + (1 - tick) * 176} className="system-confidence-trend__axis">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          <path d={trendLines.system} className="system-confidence-trend__line system-confidence-trend__line--system" />
          {showConfidenceSeries.player ? <path d={trendLines.player} className="system-confidence-trend__line system-confidence-trend__line--player" /> : null}
          {showConfidenceSeries.island ? <path d={trendLines.island} className="system-confidence-trend__line system-confidence-trend__line--island" /> : null}
          {showConfidenceSeries.cohort ? <path d={trendLines.cohort} className="system-confidence-trend__line system-confidence-trend__line--cohort" /> : null}
          {showConfidenceSeries.tag ? <path d={trendLines.tag} className="system-confidence-trend__line system-confidence-trend__line--tag" /> : null}
          <text x="48" y="214" className="system-confidence-trend__axis">
            Turn {summary.trend[0]?.turn ?? 0}
          </text>
          <text x="680" y="214" className="system-confidence-trend__axis">
            Turn {summary.trend.at(-1)?.turn ?? 0}
          </text>
        </svg>
      </div>

      <div className="system-health-audit">
        <button type="button" className="button button--ghost" onClick={() => setShowFormulaAudit((value) => !value)}>
          {showFormulaAudit ? 'Hide formula details' : 'Formula details'}
        </button>
        {showFormulaAudit ? (
          <div className="system-health-audit__content">
            <p className="muted">{SYSTEM_HEALTH_FORMULA_SPEC.caveats.overview}</p>

            <section className="system-health-audit__section">
              <h4>System Coverage composite</h4>
              <p className="muted">Weights sum to {(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite) * 100).toFixed(0)}%.</p>
              <ul className="diagnosis-list">
                {SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite.map((item) => (
                  <li key={item.key}>
                    {item.label}: {(item.weight * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            </section>

            <section className="system-health-audit__section">
              <h4>System Confidence composite</h4>
              <p className="muted">Weights sum to {(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite) * 100).toFixed(0)}%.</p>
              <ul className="diagnosis-list">
                {SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite.map((item) => (
                  <li key={item.key}>
                    {item.label}: {(item.weight * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            </section>

            <section className="system-health-audit__section">
              <h4>Player Confidence gate and diagnosis lookup</h4>
              <p className="muted">Evidence gate: `{SYSTEM_HEALTH_FORMULA_AUDIT.playerEvidenceGate}` must be {'>'} 0 before player confidence contributes.</p>
              <ul className="diagnosis-list">
                {Object.entries(SYSTEM_HEALTH_FORMULA_AUDIT.playerDiagnosisWeights).map(([diagnosis, weight]) => (
                  <li key={diagnosis}>
                    {diagnosis}: {weight.toFixed(2)}
                  </li>
                ))}
              </ul>
            </section>

            <section className="system-health-audit__section">
              <h4>Proxy caveats</h4>
              <p className="muted">{SYSTEM_HEALTH_FORMULA_SPEC.caveats.tagConfidence}</p>
            </section>
          </div>
        ) : null}
      </div>

      <p className="muted">Declared-cohort signal remains available in drilldown surfaces, not as the top-level platform metric.</p>
    </Panel>
  );
}

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
  id?: string;
  summary: SystemHealthSummary;
  showConfidenceSeries: ConfidenceSeriesState;
  onToggleSeries: (key: keyof ConfidenceSeriesState) => void;
  collapsed?: boolean;
}

type PopoverKey =
  | 'systemCoverage'
  | 'systemConfidence'
  | 'playerConfidence'
  | 'islandConfidence'
  | 'cohortConfidence'
  | 'tagConfidence';

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

export function SystemHealthPanel({ id, summary, showConfidenceSeries, onToggleSeries, collapsed = false }: SystemHealthPanelProps) {
  const [openPopover, setOpenPopover] = useState<PopoverKey | null>(null);

  const trendLines = useMemo(
    () => ({
      system: buildLinePath(summary.trend.map((point) => point.systemHealthIndex), 760, 220, 16),
      player: buildLinePath(summary.trend.map((point) => point.playerHealthIndex), 760, 220, 16),
      island: buildLinePath(summary.trend.map((point) => point.islandHealthIndex), 760, 220, 16),
      cohort: buildLinePath(summary.trend.map((point) => point.cohortHealthIndex), 760, 220, 16),
      tag: buildLinePath(summary.trend.map((point) => point.tagHealthIndex), 760, 220, 16)
    }),
    [summary.trend]
  );

  return (
    <Panel id={id} title="System Health" className="panel--full" collapsible defaultCollapsed={collapsed}>
      <div className="system-confidence-header">
        <div className="system-confidence-header__headline">
          <div className="system-health-metric-header-row">
            <p className="eyebrow">System coverage</p>
            <button
              type="button"
              className="system-health-affordance"
              onClick={() => setOpenPopover((current) => (current === 'systemCoverage' ? null : 'systemCoverage'))}
              aria-label="Open System Coverage explanation and formula"
              aria-expanded={openPopover === 'systemCoverage'}
            >
              ?ƒ
            </button>
            {openPopover === 'systemCoverage' ? (
              <div className="system-health-popover" role="dialog" aria-label="System Coverage details">
                <section className="system-health-popover__section">
                  <h5>What this means</h5>
                  <p>Coverage tracks evidence distribution and discovery operability across players, islands, cohorts, and tags, not correctness.</p>
                </section>
                <section className="system-health-popover__section">
                  <h5>Formula</h5>
                  <p>Composite weights sum to {(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite) * 100).toFixed(0)}%.</p>
                  <ul>
                    {SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite.map((item) => (
                      <li key={item.key}>
                        {item.label}: {(item.weight * 100).toFixed(0)}%
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </div>
          <h3 className="system-confidence-header__value">{formatPercent(summary.systemCoverage)}</h3>
          <p className="muted">{formatSigned(summary.coverageDelta * 100)} pts over this run.</p>

          <div className="system-health-metric-header-row">
            <p className="eyebrow">System health index</p>
            <button
              type="button"
              className="system-health-affordance"
              onClick={() => setOpenPopover((current) => (current === 'systemConfidence' ? null : 'systemConfidence'))}
              aria-label="Open system health index explanation and formula"
              aria-expanded={openPopover === 'systemConfidence'}
            >
              ?ƒ
            </button>
            {openPopover === 'systemConfidence' ? (
              <div className="system-health-popover" role="dialog" aria-label="System health index details">
                <section className="system-health-popover__section">
                  <h5>What this means</h5>
                  <p>The health index tracks evidence-weighted coherence and trustworthiness of current structure, not ground-truth accuracy.</p>
                </section>
                <section className="system-health-popover__section">
                  <h5>Formula</h5>
                  <p>Composite weights sum to {(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite) * 100).toFixed(0)}%.</p>
                  <ul>
                    {SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite.map((item) => (
                      <li key={item.key}>
                        {item.label}: {(item.weight * 100).toFixed(0)}%
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </div>
          <p className="muted">{formatPercent(summary.systemHealthIndex)} ({formatSigned(summary.healthDelta * 100)} pts)</p>
        </div>
        <aside className="system-confidence-header__howto" aria-label="How to read system health">
          <p className="muted">
            Coverage tracks evidence spread across players, islands, cohorts, and tags. Confidence here is a dashboard-level
            health proxy, not the canonical model confidence used elsewhere. It tracks whether the current structure is
            coherent and trustworthy given available evidence.
          </p>
        </aside>
      </div>

      <div className="system-confidence-cards">
        <article className={`metric-card system-confidence-card${showConfidenceSeries.player ? ' system-confidence-card--active' : ''}`}>
          <button
            type="button"
            className="system-confidence-card__toggle-hitbox"
            aria-label={showConfidenceSeries.player ? 'Hide player health trend line' : 'Show player health trend line'}
            aria-pressed={showConfidenceSeries.player}
            onClick={() => onToggleSeries('player')}
          />
          <button
            type="button"
            className="system-health-affordance system-health-card-affordance"
            onClick={(event) => {
              event.stopPropagation();
              setOpenPopover((current) => (current === 'playerConfidence' ? null : 'playerConfidence'));
            }}
            aria-label="Open player health index explanation and formula"
            aria-expanded={openPopover === 'playerConfidence'}
          >
            ?ƒ
          </button>
          <div className="metric-card__label">Player health index (proxy)</div>
          {openPopover === 'playerConfidence' ? (
            <div className="system-health-popover system-health-popover--card" role="dialog" aria-label="Player health index details">
              <section className="system-health-popover__section">
                <h5>What this means</h5>
                <p>High-confidence mismatch and inverse patterns can still raise the player health index when rating evidence is strong.</p>
              </section>
              <section className="system-health-popover__section">
                <h5>Formula</h5>
                <p>Gate: `{SYSTEM_HEALTH_FORMULA_AUDIT.playerEvidenceGate}` &gt; 0.</p>
                <p>
                  Blend: behavior score {SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.behaviorScoreWeight.toFixed(2)} + diagnosis weight{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeight.toFixed(2)}.
                </p>
                <ul>
                  {Object.entries(SYSTEM_HEALTH_FORMULA_AUDIT.playerDiagnosisWeights).map(([diagnosis, weight]) => (
                    <li key={diagnosis}>
                      {diagnosis}: {weight.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.playerHealthIndex)}</div>
          <div className="metric-card__helper">Legacy proxy. Mismatch/inverse profiles can still score high.</div>
        </article>

        <article className={`metric-card system-confidence-card${showConfidenceSeries.island ? ' system-confidence-card--active' : ''}`}>
          <button
            type="button"
            className="system-confidence-card__toggle-hitbox"
            aria-label={showConfidenceSeries.island ? 'Hide island health trend line' : 'Show island health trend line'}
            aria-pressed={showConfidenceSeries.island}
            onClick={() => onToggleSeries('island')}
          />
          <button
            type="button"
            className="system-health-affordance system-health-card-affordance"
            onClick={(event) => {
              event.stopPropagation();
              setOpenPopover((current) => (current === 'islandConfidence' ? null : 'islandConfidence'));
            }}
            aria-label="Open island health index explanation and formula"
            aria-expanded={openPopover === 'islandConfidence'}
          >
            ?ƒ
          </button>
          <div className="metric-card__label">Island health index (proxy)</div>
          {openPopover === 'islandConfidence' ? (
            <div className="system-health-popover system-health-popover--card" role="dialog" aria-label="Island health index details">
              <section className="system-health-popover__section">
                <h5>What this means</h5>
                <p>The island health index reflects affinity interpretability weighted by observed evidence volume.</p>
              </section>
              <section className="system-health-popover__section">
                <h5>Formula</h5>
                <p>
                  Affinity confidence weight: {SYSTEM_HEALTH_FORMULA_SPEC.confidence.island.affinityConfidenceWeight.toFixed(2)}; evidence weight:{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.island.affinityEvidenceWeight.toFixed(2)}.
                </p>
              </section>
            </div>
          ) : null}
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.islandHealthIndex)}</div>
          <div className="metric-card__helper">Legacy proxy. Island affinity confidence with evidence weighting.</div>
        </article>

        <article className={`metric-card system-confidence-card${showConfidenceSeries.cohort ? ' system-confidence-card--active' : ''}`}>
          <button
            type="button"
            className="system-confidence-card__toggle-hitbox"
            aria-label={showConfidenceSeries.cohort ? 'Hide cohort health trend line' : 'Show cohort health trend line'}
            aria-pressed={showConfidenceSeries.cohort}
            onClick={() => onToggleSeries('cohort')}
          />
          <button
            type="button"
            className="system-health-affordance system-health-card-affordance"
            onClick={(event) => {
              event.stopPropagation();
              setOpenPopover((current) => (current === 'cohortConfidence' ? null : 'cohortConfidence'));
            }}
            aria-label="Open cohort health index explanation and formula"
            aria-expanded={openPopover === 'cohortConfidence'}
          >
            ?ƒ
          </button>
          <div className="metric-card__label">Cohort health index (proxy)</div>
          {openPopover === 'cohortConfidence' ? (
            <div className="system-health-popover system-health-popover--card" role="dialog" aria-label="Cohort health index details">
              <section className="system-health-popover__section">
                <h5>What this means</h5>
                <p>The cohort health index tracks whether cohorts remain useful explanatory structures in observed behavior.</p>
              </section>
              <section className="system-health-popover__section">
                <h5>Formula</h5>
                <p>
                  Known-top weight: {SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.knownTopWeight.toFixed(2)}; specificity:{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.specificityWeight.toFixed(2)}; evidence:{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.evidenceWeight.toFixed(2)}.
                </p>
              </section>
            </div>
          ) : null}
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.cohortHealthIndex)}</div>
          <div className="metric-card__helper">Legacy proxy. Cohort usefulness as explanatory structure.</div>
        </article>

        <article className={`metric-card system-confidence-card${showConfidenceSeries.tag ? ' system-confidence-card--active' : ''}`}>
          <button
            type="button"
            className="system-confidence-card__toggle-hitbox"
            aria-label={showConfidenceSeries.tag ? 'Hide tag proxy trend line' : 'Show tag proxy trend line'}
            aria-pressed={showConfidenceSeries.tag}
            onClick={() => onToggleSeries('tag')}
          />
          <button
            type="button"
            className="system-health-affordance system-health-card-affordance"
            onClick={(event) => {
              event.stopPropagation();
              setOpenPopover((current) => (current === 'tagConfidence' ? null : 'tagConfidence'));
            }}
            aria-label="Open tag diagnostic proxy explanation and formula"
            aria-expanded={openPopover === 'tagConfidence'}
          >
            ?ƒ
          </button>
          <div className="metric-card__label">Tag diagnostic proxy</div>
          {openPopover === 'tagConfidence' ? (
            <div className="system-health-popover system-health-popover--card" role="dialog" aria-label="Tag diagnostic proxy details">
              <section className="system-health-popover__section">
                <h5>What this means</h5>
                <p>The tag diagnostic proxy is experimental and proxy-based. It should not be treated as a strong standalone truth metric.</p>
              </section>
              <section className="system-health-popover__section">
                <h5>Formula</h5>
                <p>
                  Tag coherence: {SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.tagCoherenceWeight.toFixed(2)}; tag density:{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.tagDensityWeight.toFixed(2)}; player confidence:{' '}
                  {SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.playerConfidenceWeight.toFixed(2)}.
                </p>
              </section>
            </div>
          ) : null}
          <div className="metric-card__value metric-card__value--text">{formatPercent(summary.tagHealthIndex)}</div>
          <div className="metric-card__helper">Approximate proxy. Toggle tag confidence series.</div>
        </article>
      </div>

      <div className="system-confidence-trend">
        <p className="muted system-confidence-trend__hint">Click a health card to toggle its chart line.</p>
        <svg viewBox="0 0 760 220" role="img" aria-label="System health over time">
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
        <div className="system-confidence-trend__legend">
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--system">
            System Health Index (proxy)
          </span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--player">Player</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--island">Island</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--cohort">Cohort</span>
          <span className="system-confidence-trend__legend-item system-confidence-trend__legend-item--tag">Tag</span>
        </div>
      </div>
    </Panel>
  );
}

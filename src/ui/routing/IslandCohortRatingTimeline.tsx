import { useEffect, useMemo, useState } from 'react';
import type { CohortId } from '../../model/types.js';
import type { IslandRatingTimelineRow } from '../../model/islandEvidenceVisualization.js';

interface IslandCohortRatingTimelineProps {
  rows: readonly IslandRatingTimelineRow[];
  cohortLabelById: ReadonlyMap<CohortId, string>;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function formatSigned(value: number, digits = 3): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function runTrendLabel(first: IslandRatingTimelineRow | undefined, latest: IslandRatingTimelineRow): string {
  if (!first) {
    return 'new';
  }

  const delta = latest.affinity - first.affinity;
  if (Math.abs(delta) < 0.02) {
    return 'flat';
  }

  return delta > 0 ? `up ${formatSigned(delta)}` : `down ${formatSigned(delta)}`;
}

function buildLinePath(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function IslandCohortRatingTimeline({ rows, cohortLabelById }: IslandCohortRatingTimelineProps) {
  const cohorts = Array.from(cohortLabelById.keys());
  const [activeCohortId, setActiveCohortId] = useState<CohortId | null>(cohorts[0] ?? null);

  useEffect(() => {
    if (cohorts.length === 0) {
      if (activeCohortId !== null) {
        setActiveCohortId(null);
      }
      return;
    }

    if (!activeCohortId || !cohorts.includes(activeCohortId)) {
      setActiveCohortId(cohorts[0] ?? null);
    }
  }, [activeCohortId, cohorts]);

  const cohortStateById = useMemo(() => {
    const map = new Map<CohortId, { latest: IslandRatingTimelineRow | null; previous: IslandRatingTimelineRow | null }>();
    for (const row of rows) {
      const current = map.get(row.cohortId);
      if (current) {
        current.previous = current.latest;
        current.latest = row;
      } else {
        map.set(row.cohortId, { latest: row, previous: null });
      }
    }
    return map;
  }, [rows]);

  const displayRows = cohorts.map((cohortId) => {
    const state = cohortStateById.get(cohortId) ?? { latest: null, previous: null };
    return {
      cohortId,
      label: cohortLabelById.get(cohortId) ?? cohortId,
      latest: state.latest,
      previous: state.previous
    };
  });

  const activeRowSeries = useMemo(() => {
    if (!activeCohortId) {
      return [];
    }
    return rows
      .filter((row) => row.cohortId === activeCohortId)
      .sort((left, right) => left.turn - right.turn);
  }, [activeCohortId, rows]);

  const activeLabel = activeCohortId ? cohortLabelById.get(activeCohortId) ?? activeCohortId : 'No cohort selected';
  const activeState = activeCohortId ? cohortStateById.get(activeCohortId) ?? { latest: null, previous: null } : { latest: null, previous: null };
  const activeLatest = activeState.latest;

  const chart = useMemo(() => {
    if (activeRowSeries.length === 0) {
      return null;
    }

    const width = 760;
    const height = 240;
    const padding = { left: 52, right: 24, top: 18, bottom: 30 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const turns = activeRowSeries.map((row) => row.turn);
    const minTurn = Math.min(...turns);
    const maxTurn = Math.max(...turns);
    const minY = -1;
    const maxY = 1;
    const turnRange = Math.max(1, maxTurn - minTurn);
    const yRange = Math.max(0.001, maxY - minY);
    const xForTurn = (turn: number) => padding.left + ((turn - minTurn) / turnRange) * plotWidth;
    const yForAffinity = (affinity: number) => padding.top + (1 - (affinity - minY) / yRange) * plotHeight;

    const points = activeRowSeries.map((row) => ({
      row,
      x: xForTurn(row.turn),
      y: yForAffinity(row.affinity)
    }));
    const path = buildLinePath(points);
    const meanConfidence = activeRowSeries.reduce((sum, row) => sum + row.confidence, 0) / activeRowSeries.length;
    const meanEffectiveWeight = activeRowSeries.reduce((sum, row) => sum + row.effectiveWeight, 0) / activeRowSeries.length;
    const latest = activeRowSeries[activeRowSeries.length - 1];
    const first = activeRowSeries[0];
    return {
      width,
      height,
      padding,
      minY,
      maxY,
      points,
      path,
      meanConfidence,
      meanEffectiveWeight,
      latest,
      first
    };
  }, [activeRowSeries]);

  return (
    <div className="card island-rating-timeline">
      <div className="card__title-row">
        <strong>Island / Cohort Rating Timeline</strong>
      </div>
      <p className="muted island-rating-timeline__helper">
        Single-cohort trend view. Click a cohort key to swap the chart series. The chart defaults to one visible cohort at a time so the turn-boundary read stays legible. Affinity is signed fit, not confidence.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No island/cohort rating snapshots available for this island yet.</p>
      ) : (
        <div className="island-rating-timeline__body">
          <div className="chip-row island-rating-timeline__chips" role="tablist" aria-label="Visible cohort anchors">
            {displayRows.map((entry) => {
              const selected = entry.cohortId === activeCohortId;
              return (
                <button
                  key={entry.cohortId}
                  type="button"
                  className={`chip island-rating-timeline__chip${selected ? ' island-rating-timeline__chip--active' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setActiveCohortId(entry.cohortId)}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <div className="island-rating-timeline__summary">
            <div>
              <div className="island-rating-timeline__summary-label">Selected cohort</div>
              <strong>{activeLabel}</strong>
            </div>
            <div>
              <div className="island-rating-timeline__summary-label">Latest turn</div>
              <strong>{activeLatest ? activeLatest.turn : 'n/a'}</strong>
            </div>
            <div>
              <div className="island-rating-timeline__summary-label">Affinity</div>
              <strong>{activeLatest ? formatSigned(activeLatest.affinity) : 'n/a'}</strong>
            </div>
            <div>
              <div className="island-rating-timeline__summary-label">Confidence</div>
              <strong>{activeLatest ? formatPercent(activeLatest.confidence) : 'n/a'}</strong>
            </div>
            <div>
              <div className="island-rating-timeline__summary-label">RD</div>
              <strong>{activeLatest ? activeLatest.ratingDeviation.toFixed(3) : 'n/a'}</strong>
            </div>
            <div>
              <div className="island-rating-timeline__summary-label">Run trend</div>
              <strong>{chart?.first && chart.latest ? runTrendLabel(chart.first, chart.latest) : 'no data'}</strong>
            </div>
          </div>

          <div className="island-rating-timeline__chart-shell">
            <svg className="island-rating-timeline__chart" viewBox={`0 0 ${chart?.width ?? 760} ${chart?.height ?? 240}`} role="img" aria-label="Island cohort rating timeline">
              <rect x="0" y="0" width={chart?.width ?? 760} height={chart?.height ?? 240} className="island-rating-timeline__chart-bg" />
              {chart ? (
                <>
                  {[0, 0.5, 1].map((tick) => (
                    <g key={tick}>
                      <line
                        x1={chart.padding.left}
                        y1={chart.padding.top + (1 - tick) * (chart.height - chart.padding.top - chart.padding.bottom)}
                        x2={chart.width - chart.padding.right}
                        y2={chart.padding.top + (1 - tick) * (chart.height - chart.padding.top - chart.padding.bottom)}
                        className="island-rating-timeline__grid"
                      />
                      <text
                        x="10"
                        y={chart.padding.top + 4 + (1 - tick) * (chart.height - chart.padding.top - chart.padding.bottom)}
                        className="island-rating-timeline__axis-label"
                      >
                        {tick === 1 ? '+1' : tick === 0.5 ? '0' : '-1'}
                      </text>
                    </g>
                  ))}
                  <line
                    x1={chart.padding.left}
                    y1={chart.height - chart.padding.bottom}
                    x2={chart.width - chart.padding.right}
                    y2={chart.height - chart.padding.bottom}
                    className="island-rating-timeline__axis-line"
                  />
                  <line
                    x1={chart.padding.left}
                    y1={chart.padding.top}
                    x2={chart.padding.left}
                    y2={chart.height - chart.padding.bottom}
                    className="island-rating-timeline__axis-line"
                  />
                  <path d={chart.path} className="island-rating-timeline__line" />
                  {chart.points.map((point, index) => (
                    <g key={`${point.row.cohortId}-${point.row.turn}`}>
                      <circle cx={point.x} cy={point.y} r={index === chart.points.length - 1 ? 5 : 3.5} className="island-rating-timeline__point" />
                      <text x={point.x} y={chart.height - 10} textAnchor="middle" className="island-rating-timeline__tick">
                        {point.row.turn}
                      </text>
                    </g>
                  ))}
                </>
              ) : null}
            </svg>
          </div>

          <div className="island-rating-timeline__legend">
            <span className="island-rating-timeline__legend-item island-rating-timeline__legend-item--active">
              Selected cohort line
            </span>
            <span className="island-rating-timeline__legend-item">Y axis = signed affinity, not confidence</span>
            <span className="island-rating-timeline__legend-item">Latest mean confidence {chart ? formatPercent(chart.meanConfidence) : 'n/a'}</span>
            <span className="island-rating-timeline__legend-item">Mean effective weight {chart ? chart.meanEffectiveWeight.toFixed(3) : 'n/a'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

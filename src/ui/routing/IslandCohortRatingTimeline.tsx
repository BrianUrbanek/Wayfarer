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

export function IslandCohortRatingTimeline({ rows, cohortLabelById }: IslandCohortRatingTimelineProps) {
  const turns = Array.from(new Set(rows.map((row) => row.turn))).sort((a, b) => a - b);
  const cohorts = Array.from(cohortLabelById.keys());
  const width = 640;
  const height = 220;
  const margin = { top: 18, right: 18, bottom: 24, left: 32 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xForTurn = (turn: number) => {
    if (turns.length <= 1) return margin.left + chartWidth / 2;
    const minTurn = turns[0] ?? 0;
    const maxTurn = turns[turns.length - 1] ?? 1;
    return margin.left + ((turn - minTurn) / Math.max(1, maxTurn - minTurn)) * chartWidth;
  };
  const yForAffinity = (value: number) => margin.top + (1 - (clamp01((value + 1) / 2))) * chartHeight;

  return (
    <div className="card island-rating-timeline">
      <div className="card__title-row"><strong>Island / Cohort Rating Timeline</strong></div>
      <p className="muted island-rating-timeline__helper">
        Turn-by-turn projection from island/cohort rating snapshots. Affinity is the primary trace; confidence/RD/uncertainty/volatility stay visible in the table.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No island/cohort rating snapshots available for this island yet.</p>
      ) : (
        <>
          <svg className="island-rating-timeline__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Island cohort timeline">
            <line x1={margin.left} y1={margin.top + chartHeight / 2} x2={margin.left + chartWidth} y2={margin.top + chartHeight / 2} className="island-rating-timeline__axis" />
            {cohorts.map((cohortId, cohortIndex) => {
              const cohortRows = rows.filter((row) => row.cohortId === cohortId);
              const points = cohortRows.map((row) => `${xForTurn(row.turn)},${yForAffinity(row.affinity)}`).join(' ');
              return (
                <g key={cohortId}>
                  {points ? <polyline points={points} className={`island-rating-timeline__line island-rating-timeline__line--${cohortIndex % 5}`} /> : null}
                </g>
              );
            })}
          </svg>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">Turn</th><th scope="col">Cohort</th><th scope="col" className="report-table__cell--right">Affinity</th>
                  <th scope="col" className="report-table__cell--right">Confidence</th><th scope="col" className="report-table__cell--right">RD</th>
                  <th scope="col" className="report-table__cell--right">Uncertainty</th><th scope="col" className="report-table__cell--right">Volatility</th>
                  <th scope="col" className="report-table__cell--right">Effective weight</th><th scope="col" className="report-table__cell--right">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.turn}-${row.cohortId}`}>
                    <td>{row.turn}</td><td>{cohortLabelById.get(row.cohortId) ?? row.cohortId}</td>
                    <td className="report-table__cell--right">{row.affinity.toFixed(3)}</td><td className="report-table__cell--right">{row.confidence.toFixed(3)}</td>
                    <td className="report-table__cell--right">{row.ratingDeviation.toFixed(3)}</td><td className="report-table__cell--right">{row.uncertainty.toFixed(3)}</td>
                    <td className="report-table__cell--right">{row.volatility.toFixed(3)}</td><td className="report-table__cell--right">{row.effectiveWeight.toFixed(3)}</td>
                    <td className="report-table__cell--right">{row.evidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

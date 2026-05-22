import type { CohortId } from '../../model/types.js';
import type { IslandEvidenceConstellation } from '../../model/islandEvidenceVisualization.js';

interface IslandEvidenceConstellationProps {
  data: IslandEvidenceConstellation;
}

function formatSigned(value: number, digits = 3): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

export function IslandEvidenceConstellationView({ data }: IslandEvidenceConstellationProps) {
  const totalPoints = data.points.length;
  const positive = data.points.filter((point) => point.rating > 0).length;
  const neutral = data.points.filter((point) => point.rating === 0).length;
  const negative = data.points.filter((point) => point.rating < 0).length;
  const noClearCohort = data.points.filter((point) => !point.primaryCohortId).length;
  const totalResolvedPoints = totalPoints - noClearCohort;
  const strongestSpoke = [...data.spokes].sort((left, right) => right.totalPrimaryWeight - left.totalPrimaryWeight || left.cohortLabel.localeCompare(right.cohortLabel))[0] ?? null;
  const topCohortLabel = strongestSpoke ? strongestSpoke.cohortLabel : 'n/a';

  return (
    <div className="card island-evidence-constellation">
      <div className="card__title-row">
        <strong>Island Evidence Constellation</strong>
      </div>
      <p className="muted island-evidence-constellation__helper">
        Experimental analyst evidence-shape view. Center = selected island. Spokes = visible cohort anchors. Points = rating events.
        Radius uses existing Rating Event Weight when available, otherwise a visualization-only proxy. No-clear-cohort points are shown explicitly so totals reconcile.
      </p>
      {totalPoints === 0 ? (
        <p className="muted">No rating evidence events are available for this island yet.</p>
      ) : (
        <div className="stack island-evidence-constellation__stack">
          <div className="metric-grid metric-grid--compact island-evidence-constellation__stats">
            <article className="metric-card metric-card--accent">
              <div className="metric-card__label">Total points</div>
              <div className="metric-card__value metric-card__value--text">{totalPoints}</div>
            </article>
            <article className="metric-card metric-card--accent">
              <div className="metric-card__label">Resolved</div>
              <div className="metric-card__value metric-card__value--text">{totalResolvedPoints}</div>
            </article>
            <article className="metric-card metric-card--success">
              <div className="metric-card__label">Positive</div>
              <div className="metric-card__value metric-card__value--text">{positive}</div>
            </article>
            <article className="metric-card metric-card--neutral">
              <div className="metric-card__label">Neutral</div>
              <div className="metric-card__value metric-card__value--text">{neutral}</div>
            </article>
            <article className="metric-card metric-card--danger">
              <div className="metric-card__label">Negative</div>
              <div className="metric-card__value metric-card__value--text">{negative}</div>
            </article>
            <article className="metric-card metric-card--warning">
              <div className="metric-card__label">No clear cohort</div>
              <div className="metric-card__value metric-card__value--text">{noClearCohort}</div>
            </article>
            <article className="metric-card metric-card--accent">
              <div className="metric-card__label">Strongest cohort</div>
              <div className="metric-card__value metric-card__value--text">{topCohortLabel}</div>
            </article>
          </div>
          <div className="island-evidence-constellation__legend">
            <p className="muted">
              Color and shape encode rating polarity. Strongest primary cohort is chosen by total primary weight across points, not by a new similarity model.
            </p>
          </div>
          <div className="report-table-wrap island-evidence-constellation__wrap">
            <table className="report-table report-table--dense">
              <thead>
                <tr>
                  <th scope="col">Cohort</th>
                  <th scope="col" className="report-table__cell--right">Points</th>
                  <th scope="col" className="report-table__cell--right">Primary weight</th>
                  <th scope="col" className="report-table__cell--right">Radius avg</th>
                  <th scope="col" className="report-table__cell--right">Pos</th>
                  <th scope="col" className="report-table__cell--right">Neu</th>
                  <th scope="col" className="report-table__cell--right">Neg</th>
                </tr>
              </thead>
              <tbody>
                {data.spokes
                  .slice()
                  .sort((left, right) => right.totalPrimaryWeight - left.totalPrimaryWeight || left.cohortLabel.localeCompare(right.cohortLabel))
                  .map((spoke) => {
                    const points = spoke.cohortId === ('unassigned' as CohortId)
                      ? data.points.filter((point) => !point.primaryCohortId)
                      : data.points.filter((point) => point.spokeCohortId === spoke.cohortId);
                    const pointCount = points.length;
                    const meanRadius = pointCount > 0 ? points.reduce((sum, point) => sum + point.radiusValue, 0) / pointCount : 0;
                    const pos = points.filter((point) => point.rating > 0).length;
                    const neu = points.filter((point) => point.rating === 0).length;
                    const neg = points.filter((point) => point.rating < 0).length;
                    return (
                      <tr key={spoke.cohortId}>
                        <td>{spoke.cohortLabel}</td>
                        <td className="report-table__cell--right">{pointCount}</td>
                        <td className="report-table__cell--right">{formatSigned(spoke.totalPrimaryWeight)}</td>
                        <td className="report-table__cell--right">{formatSigned(meanRadius)}</td>
                        <td className="report-table__cell--right">{pos}</td>
                        <td className="report-table__cell--right">{neu}</td>
                        <td className="report-table__cell--right">{neg}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

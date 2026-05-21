import type { CohortId } from '../../model/types.js';

export interface IslandConfidenceRadarDatum {
  cohortId: CohortId;
  confidence: number;
  label?: string;
}

interface IslandConfidenceRadarProps {
  title?: string;
  data: readonly IslandConfidenceRadarDatum[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

export function IslandConfidenceRadar({ title = 'Island confidence by cohort', data }: IslandConfidenceRadarProps) {
  const chartSize = 240;
  const center = chartSize / 2;
  const radius = 84;
  const levels = [0.25, 0.5, 0.75, 1];
  const angleStep = data.length > 0 ? (Math.PI * 2) / data.length : 0;

  const points = data.map((datum, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const value = clamp01(datum.confidence);
    const x = center + Math.cos(angle) * radius * value;
    const y = center + Math.sin(angle) * radius * value;
    const axisX = center + Math.cos(angle) * radius;
    const axisY = center + Math.sin(angle) * radius;
    const labelX = center + Math.cos(angle) * (radius + 20);
    const labelY = center + Math.sin(angle) * (radius + 20);
    return { datum, x, y, axisX, axisY, labelX, labelY };
  });

  const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="card island-confidence-radar">
      <div className="card__title-row">
        <strong>{title}</strong>
      </div>
      <p className="muted island-confidence-radar__helper">
        Confidence indicates certainty for each island/cohort read. It does not indicate whether the fit is positive or negative.
      </p>
      {data.length === 0 ? (
        <p className="muted">No cohort confidence data available.</p>
      ) : (
        <div className="island-confidence-radar__layout">
          <svg
            className="island-confidence-radar__svg"
            viewBox={`0 0 ${chartSize} ${chartSize}`}
            role="img"
            aria-label={title}
          >
            {levels.map((level) => (
              <circle
                key={level}
                cx={center}
                cy={center}
                r={radius * level}
                className="island-confidence-radar__ring"
              />
            ))}
            {points.map((point) => (
              <line
                key={`axis-${point.datum.cohortId}`}
                x1={center}
                y1={center}
                x2={point.axisX}
                y2={point.axisY}
                className="island-confidence-radar__axis"
              />
            ))}
            <polygon points={polygonPoints} className="island-confidence-radar__shape" />
            {points.map((point) => (
              <circle key={`point-${point.datum.cohortId}`} cx={point.x} cy={point.y} r={3.5} className="island-confidence-radar__point" />
            ))}
          </svg>
          <ul className="island-confidence-radar__legend">
            {points.map((point) => (
              <li key={point.datum.cohortId}>
                <span>{point.datum.label ?? point.datum.cohortId}</span>
                <strong>{toPercent(point.datum.confidence)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

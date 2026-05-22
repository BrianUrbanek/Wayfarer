import type { IslandEvidenceConstellation } from '../../model/islandEvidenceVisualization.js';

interface IslandEvidenceConstellationProps {
  data: IslandEvidenceConstellation;
}

export function IslandEvidenceConstellationView({ data }: IslandEvidenceConstellationProps) {
  const size = 280;
  const center = size / 2;
  const maxRadius = 112;
  const maxPointRadius = Math.max(1, ...data.points.map((point) => point.radiusValue));
  const spokeAngles = new Map(data.spokes.map((spoke, index) => [spoke.cohortId, -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, data.spokes.length)]));

  return (
    <div className="card island-evidence-constellation">
      <div className="card__title-row"><strong>Island Evidence Constellation</strong></div>
      <p className="muted island-evidence-constellation__helper">
        Experimental analyst evidence-shape view. This is not a canonical confidence or routing score surface.
      </p>
      {data.points.length === 0 ? (
        <p className="muted">No rating evidence events are available for this island yet.</p>
      ) : (
        <div className="island-evidence-constellation__layout">
          <svg className="island-evidence-constellation__svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Island evidence constellation">
            <circle cx={center} cy={center} r={4} className="island-evidence-constellation__center" />
            {data.spokes.map((spoke) => {
              const angle = spokeAngles.get(spoke.cohortId) ?? -Math.PI / 2;
              return <line key={spoke.cohortId} x1={center} y1={center} x2={center + Math.cos(angle) * maxRadius} y2={center + Math.sin(angle) * maxRadius} className="island-evidence-constellation__spoke" />;
            })}
            {data.points.map((point) => {
              const baseAngle = point.spokeCohortId ? spokeAngles.get(point.spokeCohortId) ?? -Math.PI / 2 : -Math.PI / 2;
              const angle = baseAngle + point.angleJitter * 0.6;
              const radius = (point.radiusValue / maxPointRadius) * maxRadius;
              const x = center + Math.cos(angle) * radius;
              const y = center + Math.sin(angle) * radius;
              const r = 2 + point.sizeValue * 3;
              return <circle key={point.eventId} cx={x} cy={y} r={Math.max(2, Math.min(8, r))} className={`island-evidence-constellation__point island-evidence-constellation__point--${point.rating > 0 ? 'positive' : point.rating < 0 ? 'negative' : 'neutral'}`} style={{ opacity: point.opacityValue }} />;
            })}
          </svg>
          <ul className="island-evidence-constellation__legend">
            <li><strong>Radius:</strong> {data.usesRatingEventWeightRows ? 'existing Rating Event Weight eventWeight (primary cohort)' : 'visual proxy from primary cohort trust weight'}</li>
            <li><strong>Point sign:</strong> positive/neutral/negative rating polarity</li>
            <li><strong>Spokes:</strong> visible cohort anchors</li>
          </ul>
        </div>
      )}
    </div>
  );
}

import type { RatingEventWeightRow } from '../../model/ratingEventWeight.js';
import { IslandConfidenceRadar, type IslandConfidenceRadarDatum } from './IslandConfidenceRadar';
import { IslandCohortRatingTimeline } from './IslandCohortRatingTimeline';
import { ObservedBehaviorEvidencePanel } from './ObservedBehaviorEvidencePanel';
import { MetricCard } from '../components/MetricCard';
import type { ObservedBehaviorIslandSummary, ObservedBehaviorRow } from '../../model/observedBehavior';
import type { CohortId } from '../../model/types.js';
import type { IslandEvidenceConstellation, IslandRatingTimelineRow } from '../../model/islandEvidenceVisualization.js';
import type { LiveIslandEvidenceRead } from '../liveEvidenceAdapter';

interface SelectedIslandEvidenceSummaryProps {
  confidenceRadarData: readonly IslandConfidenceRadarDatum[];
  ratingEventWeightRows: readonly RatingEventWeightRow[];
  observedBehaviorRows: readonly ObservedBehaviorRow[];
  observedBehaviorSummary: ObservedBehaviorIslandSummary | null;
  timelineRows: readonly IslandRatingTimelineRow[];
  constellation: IslandEvidenceConstellation;
  cohortLabelById: ReadonlyMap<CohortId, string>;
  islandLabel: string;
  liveEvidenceRead: LiveIslandEvidenceRead;
}

export function SelectedIslandEvidenceSummary({
  confidenceRadarData,
  ratingEventWeightRows,
  observedBehaviorRows,
  observedBehaviorSummary,
  timelineRows,
  constellation,
  cohortLabelById,
  islandLabel,
  liveEvidenceRead
}: SelectedIslandEvidenceSummaryProps) {
  return (
    <section className="detail-block">
      <div className="section-heading">
        <h4>Selected island evidence</h4>
        <p className="muted">
          Current confidence and directional affinity are separate diagnostic/proxy reads. The surfaces below are diagnostics, not score cards.
        </p>
      </div>
      <div className="stack">
        <section className="detail-block">
          <div className="section-heading">
            <h5>Audience read</h5>
            <p className="muted">Cohort-specific affinity, confidence proxy, RD, volatility, and evidence are shown as separate reads.</p>
          </div>
        </section>
        <IslandConfidenceRadar data={confidenceRadarData} />
        <section className="detail-block">
          <div className="section-heading">
            <h5>Confidence & stability</h5>
            <p className="muted">Confidence remains a proxy summary; RD and volatility stay visible as separate support fields.</p>
          </div>
        </section>
        <IslandCohortRatingTimeline rows={timelineRows} cohortLabelById={cohortLabelById} />
        <section className="detail-block">
          <div className="section-heading">
            <h5>Evidence provenance</h5>
            <p className="muted">Observed behavior remains visible. Legacy rating-weight and constellation proxy visuals are hidden until they can be rebuilt from modeling-core evidence projections.</p>
          </div>
          <div className="metric-grid metric-grid--compact">
            <MetricCard
              label="Evidence state"
              value={liveEvidenceRead.state}
              tone={liveEvidenceRead.state === 'canonical' ? 'success' : liveEvidenceRead.state === 'compatibility' ? 'accent' : 'warning'}
              helper={liveEvidenceRead.headline}
            />
            <MetricCard label="Source authority" value={liveEvidenceRead.sourceAuthority} helper={liveEvidenceRead.provenance} />
          </div>
          <div className="notice notice--subtle">
            <strong>{liveEvidenceRead.headline}</strong>
            <p>{liveEvidenceRead.compatibilityNote}</p>
            <p className="muted">{liveEvidenceRead.affinitySummary}</p>
            <p className="muted">{liveEvidenceRead.rdSummary}</p>
            <p className="muted">{liveEvidenceRead.volatilitySummary}</p>
            <p className="muted">
              Hidden proxy rows: {ratingEventWeightRows.length}; hidden constellation points: {constellation.points.length}.
            </p>
          </div>
        </section>
        <ObservedBehaviorEvidencePanel
          islandLabel={islandLabel}
          behaviorSummary={observedBehaviorSummary}
          behaviorRows={observedBehaviorRows}
        />
      </div>
    </section>
  );
}

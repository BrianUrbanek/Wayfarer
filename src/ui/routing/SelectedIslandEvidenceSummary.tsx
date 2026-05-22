import type { RatingEventWeightRow } from '../../model/ratingEventWeight.js';
import { IslandConfidenceRadar, type IslandConfidenceRadarDatum } from './IslandConfidenceRadar';
import { IslandCohortRatingTimeline } from './IslandCohortRatingTimeline';
import { IslandEvidenceConstellationView } from './IslandEvidenceConstellation';
import { ObservedBehaviorEvidencePanel } from './ObservedBehaviorEvidencePanel';
import { RatingEventWeightTable, type RatingEventWeightPresentationRow } from './RatingEventWeightTable';
import type { ObservedBehaviorIslandSummary, ObservedBehaviorRow } from '../../model/observedBehavior';
import type { CohortId } from '../../model/types.js';
import type { IslandEvidenceConstellation, IslandRatingTimelineRow } from '../../model/islandEvidenceVisualization.js';

interface SelectedIslandEvidenceSummaryProps {
  confidenceRadarData: readonly IslandConfidenceRadarDatum[];
  ratingEventWeightRows: readonly RatingEventWeightRow[];
  observedBehaviorRows: readonly ObservedBehaviorRow[];
  observedBehaviorSummary: ObservedBehaviorIslandSummary | null;
  timelineRows: readonly IslandRatingTimelineRow[];
  constellation: IslandEvidenceConstellation;
  cohortLabelById: ReadonlyMap<CohortId, string>;
  islandLabel: string;
}

export function SelectedIslandEvidenceSummary({
  confidenceRadarData,
  ratingEventWeightRows,
  observedBehaviorRows,
  observedBehaviorSummary,
  timelineRows,
  constellation,
  cohortLabelById,
  islandLabel
}: SelectedIslandEvidenceSummaryProps) {
  const labeledRows: RatingEventWeightPresentationRow[] = ratingEventWeightRows.map((row) => {
    const match = confidenceRadarData.find((entry) => entry.cohortId === row.cohortId);
    return {
      ...row,
      cohortLabel: match?.label ?? row.cohortId
    };
  });

  return (
    <section className="detail-block">
      <div className="section-heading">
        <h4>Selected island evidence</h4>
        <p className="muted">
          Current confidence and directional affinity are separate reads. The surfaces below are diagnostics, not score cards.
        </p>
      </div>
      <div className="stack">
        <IslandConfidenceRadar data={confidenceRadarData} />
        <IslandCohortRatingTimeline rows={timelineRows} cohortLabelById={cohortLabelById} />
        <IslandEvidenceConstellationView data={constellation} />
        <RatingEventWeightTable rows={labeledRows} />
        <ObservedBehaviorEvidencePanel
          islandLabel={islandLabel}
          behaviorSummary={observedBehaviorSummary}
          behaviorRows={observedBehaviorRows}
        />
      </div>
    </section>
  );
}

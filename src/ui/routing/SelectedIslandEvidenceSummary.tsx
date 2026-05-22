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
        <p>
          Confidence shows how certain each island/cohort read is, while directional affinity remains the separate fit-polarity read.
        </p>
        <p className="muted">
          Rating Event Weight is shown as a current-context diagnostic: trust proxy multiplied by current uncertainty leverage
          projected from the island/cohort rating state. Historical snapshots exist for turn-boundary analysis, but this table
          intentionally shows the current selected-island context.
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

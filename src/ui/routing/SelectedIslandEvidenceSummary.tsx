import type { RatingEventWeightRow } from '../../model/ratingEventWeight.js';
import { IslandConfidenceRadar, type IslandConfidenceRadarDatum } from './IslandConfidenceRadar';
import { RatingEventWeightTable, type RatingEventWeightPresentationRow } from './RatingEventWeightTable';

interface SelectedIslandEvidenceSummaryProps {
  confidenceRadarData: readonly IslandConfidenceRadarDatum[];
  ratingEventWeightRows: readonly RatingEventWeightRow[];
}

export function SelectedIslandEvidenceSummary({
  confidenceRadarData,
  ratingEventWeightRows
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
          Rating Event Weight uses current-context trust proxy multiplied by current-context leverage (1 - confidence). Historical
          confidence snapshots are not implemented yet, so leverage is computed from current confidence.
        </p>
      </div>
      <div className="stack">
        <IslandConfidenceRadar data={confidenceRadarData} />
        <RatingEventWeightTable rows={labeledRows} />
      </div>
    </section>
  );
}

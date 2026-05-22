import type { CohortId, IslandId, Rating, UserId } from './types.js';
import type { IslandAffinityReport } from './affinity.js';

export interface RatingEventWeightInputEvent {
  id: string;
  turn: number;
  userId: UserId;
  islandId: IslandId;
  rating: Rating;
  raterSignalWeights: Readonly<Record<CohortId, number>>;
}

export interface RatingEventWeightRow {
  eventId: string;
  userId: UserId;
  islandId: IslandId;
  cohortId: CohortId;
  rating: Rating;
  trustWeight: number;
  currentContextConfidence: number;
  uncertaintyLeverage: number;
  eventWeight: number;
  directionalContribution: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function deriveRatingEventWeightsForIsland(
  islandId: IslandId,
  events: readonly RatingEventWeightInputEvent[],
  affinityReport: IslandAffinityReport | undefined
): RatingEventWeightRow[] {
  if (!affinityReport) {
    return [];
  }

  const confidenceByCohort = new Map(affinityReport.estimates.map((estimate) => [estimate.cohortId, clamp01(estimate.confidence)]));

  const rows: RatingEventWeightRow[] = [];
  for (const event of events) {
    if (event.islandId !== islandId) {
      continue;
    }

    for (const [cohortId, confidence] of confidenceByCohort.entries()) {
      const trustWeight = Math.max(0, event.raterSignalWeights[cohortId] ?? 0);
      const uncertaintyLeverage = clamp01(1 - confidence);
      const eventWeight = trustWeight * uncertaintyLeverage;
      rows.push({
        eventId: event.id,
        userId: event.userId,
        islandId: event.islandId,
        cohortId,
        rating: event.rating,
        trustWeight,
        currentContextConfidence: confidence,
        uncertaintyLeverage,
        eventWeight,
        directionalContribution: event.rating * eventWeight
      });
    }
  }

  return rows.sort((left, right) => {
    if (left.userId !== right.userId) return left.userId.localeCompare(right.userId);
    if (left.cohortId !== right.cohortId) return left.cohortId.localeCompare(right.cohortId);
    return left.eventId.localeCompare(right.eventId);
  });
}

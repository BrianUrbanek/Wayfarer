import type { SimulationState } from './simulation.js';

export interface ConfidenceGrowthRow {
  turn: number;
  ratingsCreated: number;
  cumulativeRatingEvents: number;
  averageIslandCohortConfidence: number;
  averageEffectiveWeight: number;
  estimatesAbove25: number;
  estimatesAbove50: number;
  estimatesAbove75: number;
  routedIslandCount: number;
  safeFitCount: number;
  discoveryProbeCount: number;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildConfidenceGrowthRows(state: SimulationState): ConfidenceGrowthRow[] {
  const turns = state.turnHistory.slice().sort((left, right) => left.turn - right.turn);
  let cumulativeRatingEvents = 0;

  return turns.map((summary) => {
    const snapshots = state.confidenceSnapshots.filter((snapshot) => snapshot.turn === summary.turn);
    const averageIslandCohortConfidence = mean(snapshots.map((snapshot) => snapshot.confidence));
    const averageEffectiveWeight = mean(snapshots.map((snapshot) => snapshot.effectiveWeight));

    cumulativeRatingEvents += summary.ratingsCreated;

    return {
      turn: summary.turn,
      ratingsCreated: summary.ratingsCreated,
      cumulativeRatingEvents,
      averageIslandCohortConfidence,
      averageEffectiveWeight,
      estimatesAbove25: snapshots.filter((snapshot) => snapshot.confidence >= 0.25).length,
      estimatesAbove50: snapshots.filter((snapshot) => snapshot.confidence >= 0.5).length,
      estimatesAbove75: snapshots.filter((snapshot) => snapshot.confidence >= 0.75).length,
      routedIslandCount: summary.routedIslandIds.length,
      safeFitCount: summary.recommendationKinds.SAFE_FIT,
      discoveryProbeCount: summary.recommendationKinds.DISCOVERY_PROBE
    };
  });
}

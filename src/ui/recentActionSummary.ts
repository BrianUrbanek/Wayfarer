import type { SimulationTurnSummary } from '../model/simulation.js';

export type RecentActionKind = 'scenario-executed' | 'turn-advanced' | 'batch-turns-advanced' | 'simulation-reset' | 'scenario-imported' | 'scenario-exported';

export interface RecentActionState {
  kind: RecentActionKind;
  scenarioLabel: string;
  turnModeLabel: string;
  previousTurn: number;
  currentTurn: number;
  latestTurnSummary: SimulationTurnSummary | null;
  batchSize?: number;
  exportFileName?: string;
}

export interface BatchTotals {
  ratingsCreated: number;
  organicRatingsCreated: number;
  guidedRatingsCreated: number;
  participatingUsers: number;
  newlyRatedIslands: number;
  routedIslands: number;
  safeFitsRouted: number;
  discoveryProbesRouted: number;
}

export function aggregateBatchTotals(turns: readonly SimulationTurnSummary[]): BatchTotals {
  const participantIds = new Set<string>();
  const islandIds = new Set<string>();
  const routedIslandIds = new Set<string>();
  let ratingsCreated = 0;
  let organicRatingsCreated = 0;
  let guidedRatingsCreated = 0;
  let safeFitsRouted = 0;
  let discoveryProbesRouted = 0;

  for (const turn of turns) {
    ratingsCreated += turn.ratingsCreated;
    organicRatingsCreated += turn.organicRatingsCreated;
    guidedRatingsCreated += turn.guidedRatingsCreated;
    safeFitsRouted += turn.recommendationKinds.SAFE_FIT;
    discoveryProbesRouted += turn.recommendationKinds.DISCOVERY_PROBE;
    for (const userId of turn.participatingUserIds) {
      participantIds.add(userId);
    }
    for (const islandId of turn.newlyRatedIslandIds) {
      islandIds.add(islandId);
    }
    for (const islandId of turn.routedIslandIds) {
      routedIslandIds.add(islandId);
    }
  }

  return {
    ratingsCreated,
    organicRatingsCreated,
    guidedRatingsCreated,
    participatingUsers: participantIds.size,
    newlyRatedIslands: islandIds.size,
    routedIslands: routedIslandIds.size,
    safeFitsRouted,
    discoveryProbesRouted
  };
}

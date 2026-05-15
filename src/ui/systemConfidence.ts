import type { SimulationState } from '../model/simulation.js';

export interface ConfidencePoint {
  turn: number;
  systemConfidence: number;
  playerBaseConfidence: number;
  islandOptionsConfidence: number;
  cohortOptionsConfidence: number;
  tagOptionsConfidence: number;
}

export interface SystemConfidenceSummary {
  systemConfidence: number;
  runDelta: number;
  playerBaseConfidence: number;
  islandOptionsConfidence: number;
  cohortOptionsConfidence: number;
  tagOptionsConfidence: number;
  trend: ConfidencePoint[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countRatedByUser(state: SimulationState): number[] {
  return state.users.map((user) => Object.values(user.ratings).filter((rating) => rating !== null).length);
}

export function buildSystemConfidenceSummary(state: SimulationState): SystemConfidenceSummary {
  const userCount = Math.max(state.users.length, 1);
  const islandCount = Math.max(state.islands.length, 1);
  const tagCount = Math.max(state.allTags.length, 1);

  const ratedCounts = countRatedByUser(state);
  const ratingsPerUserCoverage = mean(ratedCounts.map((count) => clamp01(count / islandCount)));
  const turnProgress = clamp01(state.currentTurn / Math.max(1, state.currentTurn + 6));
  const playerBaseConfidence = clamp01((ratingsPerUserCoverage * 0.75) + (turnProgress * 0.25));

  const ratedIslands = new Set(state.ratingEvents.map((event) => event.islandId)).size;
  const routedIslands = new Set(state.turnHistory.flatMap((turn) => turn.routedIslandIds)).size;
  const islandCoverage = clamp01(ratedIslands / islandCount);
  const routedCoverage = clamp01(routedIslands / islandCount);
  const islandOptionsConfidence = clamp01((islandCoverage * 0.7) + (routedCoverage * 0.3));

  const cohortSignalCoverage =
    state.cohorts.length === 0
      ? 0
      : mean(
          state.cohorts.map((cohort) => {
            const count = state.ratingEvents.filter((event) => (event.raterSignalWeights[cohort.id] ?? 0) > 0).length;
            return clamp01(count / Math.max(1, state.ratingEvents.length));
          })
        );
  const diagnosisCoverage = clamp01(
    (state.users.length - (state.pseudoCohortAnalysis.allReports.length || 0)) / userCount
  );
  const cohortOptionsConfidence = clamp01((cohortSignalCoverage * 0.6) + (diagnosisCoverage * 0.4));

  // Tag confidence is an approximate proxy from declared-tag density and rating coverage.
  const avgDeclaredTags = mean(state.users.map((user) => user.declaredTags.length));
  const tagDensity = clamp01(avgDeclaredTags / Math.max(1, tagCount));
  const tagOptionsConfidence = clamp01((tagDensity * 0.5) + (ratingsPerUserCoverage * 0.5));

  const systemConfidence = clamp01(
    (playerBaseConfidence * 0.35) +
      (islandOptionsConfidence * 0.3) +
      (cohortOptionsConfidence * 0.2) +
      (tagOptionsConfidence * 0.15)
  );

  const trend: ConfidencePoint[] = state.turnHistory
    .slice()
    .sort((left, right) => left.turn - right.turn)
    .map((turn) => {
      const turnProgressPoint = clamp01(turn.turn / Math.max(1, state.currentTurn + 6));
      const turnRatingsCoverage = clamp01(turn.ratingsCreated / Math.max(1, userCount));
      const pointPlayer = clamp01((turnRatingsCoverage * 0.6) + (turnProgressPoint * 0.4));
      const pointIsland = clamp01((turn.newlyRatedIslandIds.length / islandCount) * 0.7 + (turn.routedIslandIds.length / islandCount) * 0.3);
      const pointCohort = clamp01(turn.participatingUserIds.length / userCount);
      const pointTag = clamp01((turn.ratingsCreated / Math.max(1, userCount * 2)) * 0.6 + tagDensity * 0.4);
      const pointSystem = clamp01((pointPlayer * 0.35) + (pointIsland * 0.3) + (pointCohort * 0.2) + (pointTag * 0.15));
      return {
        turn: turn.turn,
        systemConfidence: pointSystem,
        playerBaseConfidence: pointPlayer,
        islandOptionsConfidence: pointIsland,
        cohortOptionsConfidence: pointCohort,
        tagOptionsConfidence: pointTag
      };
    });

  const runStart = trend[0]?.systemConfidence ?? systemConfidence;

  return {
    systemConfidence,
    runDelta: clamp01(systemConfidence) - clamp01(runStart),
    playerBaseConfidence,
    islandOptionsConfidence,
    cohortOptionsConfidence,
    tagOptionsConfidence,
    trend
  };
}

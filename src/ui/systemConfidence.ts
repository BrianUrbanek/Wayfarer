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

function computeConfidenceFromCoverage(input: {
  ratingsPerUserCoverage: number;
  turnProgress: number;
  islandCoverage: number;
  routedCoverage: number;
  cohortSignalCoverage: number;
  diagnosisCoverage: number;
  tagDensity: number;
}): Omit<ConfidencePoint, 'turn'> {
  const playerBaseConfidence = clamp01((input.ratingsPerUserCoverage * 0.75) + (input.turnProgress * 0.25));
  const islandOptionsConfidence = clamp01((input.islandCoverage * 0.7) + (input.routedCoverage * 0.3));
  const cohortOptionsConfidence = clamp01((input.cohortSignalCoverage * 0.6) + (input.diagnosisCoverage * 0.4));
  const tagOptionsConfidence = clamp01((input.tagDensity * 0.5) + (input.ratingsPerUserCoverage * 0.5));
  const systemConfidence = clamp01(
    (playerBaseConfidence * 0.35) +
      (islandOptionsConfidence * 0.3) +
      (cohortOptionsConfidence * 0.2) +
      (tagOptionsConfidence * 0.15)
  );

  return {
    systemConfidence,
    playerBaseConfidence,
    islandOptionsConfidence,
    cohortOptionsConfidence,
    tagOptionsConfidence
  };
}

export function buildSystemConfidenceSummary(state: SimulationState): SystemConfidenceSummary {
  const userCount = Math.max(state.users.length, 1);
  const islandCount = Math.max(state.islands.length, 1);
  const tagCount = Math.max(state.allTags.length, 1);

  const ratedCounts = countRatedByUser(state);
  const ratingsPerUserCoverage = mean(ratedCounts.map((count) => clamp01(count / islandCount)));
  const turnProgress = clamp01(state.currentTurn / Math.max(1, state.currentTurn + 6));
  const ratedIslands = new Set(state.ratingEvents.map((event) => event.islandId)).size;
  const routedIslands = new Set(state.turnHistory.flatMap((turn) => turn.routedIslandIds)).size;
  const islandCoverage = clamp01(ratedIslands / islandCount);
  const routedCoverage = clamp01(routedIslands / islandCount);

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
  // Tag confidence is an approximate proxy from declared-tag density and rating coverage.
  const avgDeclaredTags = mean(state.users.map((user) => user.declaredTags.length));
  const tagDensity = clamp01(avgDeclaredTags / Math.max(1, tagCount));
  const currentConfidence = computeConfidenceFromCoverage({
    ratingsPerUserCoverage,
    turnProgress,
    islandCoverage,
    routedCoverage,
    cohortSignalCoverage,
    diagnosisCoverage,
    tagDensity
  });

  const trend: ConfidencePoint[] = state.turnHistory
    .slice()
    .sort((left, right) => left.turn - right.turn)
    .map((turn) => {
      const eventsToTurn = state.ratingEvents.filter((event) => event.turn <= turn.turn);
      const ratedPairsToTurn = new Map<string, number>();
      for (const event of eventsToTurn) {
        ratedPairsToTurn.set(`${event.userId}:${event.islandId}`, event.rating);
      }
      const ratingsPerUserToTurn = clamp01((ratedPairsToTurn.size / userCount) / islandCount);
      const turnProgressPoint = clamp01(turn.turn / Math.max(1, state.currentTurn + 6));
      const islandsToTurn = new Set(eventsToTurn.map((event) => event.islandId)).size;
      const routedToTurn = new Set(
        state.turnHistory.filter((entry) => entry.turn <= turn.turn).flatMap((entry) => entry.routedIslandIds)
      ).size;
      const cohortSignalToTurn =
        state.cohorts.length === 0
          ? 0
          : mean(
              state.cohorts.map((cohort) => {
                const count = eventsToTurn.filter((event) => (event.raterSignalWeights[cohort.id] ?? 0) > 0).length;
                return clamp01(count / Math.max(1, eventsToTurn.length));
              })
            );
      const diagnosisPoint = diagnosisCoverage;
      const point = computeConfidenceFromCoverage({
        ratingsPerUserCoverage: ratingsPerUserToTurn,
        turnProgress: turnProgressPoint,
        islandCoverage: clamp01(islandsToTurn / islandCount),
        routedCoverage: clamp01(routedToTurn / islandCount),
        cohortSignalCoverage: cohortSignalToTurn,
        diagnosisCoverage: diagnosisPoint,
        tagDensity
      });
      return {
        turn: turn.turn,
        ...point
      };
    });

  const runStart = trend[0]?.systemConfidence ?? currentConfidence.systemConfidence;

  return {
    systemConfidence: currentConfidence.systemConfidence,
    runDelta: currentConfidence.systemConfidence - runStart,
    playerBaseConfidence: currentConfidence.playerBaseConfidence,
    islandOptionsConfidence: currentConfidence.islandOptionsConfidence,
    cohortOptionsConfidence: currentConfidence.cohortOptionsConfidence,
    tagOptionsConfidence: currentConfidence.tagOptionsConfidence,
    trend
  };
}

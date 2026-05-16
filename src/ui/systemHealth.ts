import type { SimulationState } from '../model/simulation.js';

export interface SystemHealthPoint {
  turn: number;
  systemCoverage: number;
  systemConfidence: number;
  playerCoverage: number;
  islandCoverage: number;
  cohortCoverage: number;
  tagCoverage: number;
  playerConfidence: number;
  islandConfidence: number;
  cohortConfidence: number;
  tagConfidence: number;
}

export interface SystemHealthSummary {
  systemCoverage: number;
  systemConfidence: number;
  coverageDelta: number;
  confidenceDelta: number;
  playerCoverage: number;
  islandCoverage: number;
  cohortCoverage: number;
  tagCoverage: number;
  playerConfidence: number;
  islandConfidence: number;
  cohortConfidence: number;
  tagConfidence: number;
  trend: SystemHealthPoint[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function computeAtTurn(state: SimulationState, turnLimit: number): Omit<SystemHealthPoint, 'turn'> {
  const users = Math.max(1, state.users.length);
  const islands = Math.max(1, state.islands.length);
  const tags = Math.max(1, state.allTags.length);
  const events = state.ratingEvents.filter((e) => e.turn <= turnLimit);
  const ratedPairs = new Set(events.map((e) => `${e.userId}:${e.islandId}`)).size;
  const ratedIslands = new Set(events.map((e) => e.islandId)).size;
  const routedIslands = new Set(state.turnHistory.filter((t) => t.turn <= turnLimit).flatMap((t) => t.routedIslandIds)).size;
  const progress = clamp01(turnLimit / Math.max(1, state.currentTurn + 6));

  const ratingsPerUserCoverage = clamp01((ratedPairs / users) / islands);
  const playerCoverage = clamp01((ratingsPerUserCoverage * 0.75) + (progress * 0.25));
  const islandCoverage = clamp01((ratedIslands / islands) * 0.7 + (routedIslands / islands) * 0.3);
  const cohortCoverage = state.cohorts.length
    ? mean(state.cohorts.map((c) => clamp01(events.filter((e) => (e.raterSignalWeights[c.id] ?? 0) > 0).length / Math.max(1, events.length))))
    : 0;
  const tagDensity = clamp01(mean(state.users.map((u) => u.declaredTags.length)) / tags);
  const tagCoverage = clamp01((tagDensity * 0.5) + (ratingsPerUserCoverage * 0.5));
  const systemCoverage = clamp01((playerCoverage * 0.35) + (islandCoverage * 0.3) + (cohortCoverage * 0.2) + (tagCoverage * 0.15));

  const diagnosis = Array.from(state.inferenceByUserId.values());
  const coherent = diagnosis.filter((d) => d.diagnosis.type === 'HIGH_SIGNAL' || d.diagnosis.type === 'MISMATCH_RETAG' || d.diagnosis.type === 'INVERSE_PROFILE').length;
  const ambiguityPenalty = diagnosis.filter((d) => d.diagnosis.type === 'UNKNOWN_OR_NOISY' || d.diagnosis.type === 'AMBIGUOUS').length;
  const playerConfidence = clamp01((coherent / Math.max(1, diagnosis.length)) - (ambiguityPenalty / Math.max(1, diagnosis.length)) * 0.25);

  const affinityReports = Array.from(state.islandAffinityReports.values());
  const islandConfMean = mean(affinityReports.map((r) => mean(r.estimates.map((e) => e.confidence))));
  const islandEvidence = clamp01(mean(affinityReports.map((r) => Math.min(1, r.estimates.reduce((s, e) => s + e.rawCount, 0) / Math.max(1, users)))));
  const islandConfidence = clamp01((islandConfMean * 0.65) + (islandEvidence * 0.35));

  const cohortSeparation = mean(diagnosis.map((d) => Math.max(0, d.behaviorTop.score - d.declaredTop.score + 0.5)));
  const cohortConfidence = clamp01(cohortSeparation);

  // Weak proxy: tag confidence reflects whether tag declarations remain interpretable against observed evidence.
  const tagConfidence = clamp01((tagDensity * 0.35) + (playerConfidence * 0.65));
  const systemConfidence = clamp01((playerConfidence * 0.4) + (islandConfidence * 0.35) + (cohortConfidence * 0.2) + (tagConfidence * 0.05));

  return {
    systemCoverage,
    systemConfidence,
    playerCoverage,
    islandCoverage,
    cohortCoverage,
    tagCoverage,
    playerConfidence,
    islandConfidence,
    cohortConfidence,
    tagConfidence
  };
}

export function buildSystemHealthSummary(state: SimulationState): SystemHealthSummary {
  const turns = state.turnHistory.slice().sort((a, b) => a.turn - b.turn).map((t) => t.turn);
  const trend = turns.map((turn) => ({ turn, ...computeAtTurn(state, turn) }));
  const current = computeAtTurn(state, state.currentTurn);
  const first = trend[0] ?? { turn: state.currentTurn, ...current };

  return {
    ...current,
    coverageDelta: current.systemCoverage - first.systemCoverage,
    confidenceDelta: current.systemConfidence - first.systemConfidence,
    trend
  };
}

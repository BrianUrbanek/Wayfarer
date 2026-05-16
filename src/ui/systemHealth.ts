import type { SimulationState } from '../model/simulation.js';
import { computeInference } from '../model/inference.js';
import { buildRaterSignalProfiles } from '../model/raterSignal.js';
import { buildIslandAffinityReports } from '../model/affinity.js';

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

  const ratingsByUser = new Map<string, Record<string, -1 | 0 | 1 | null>>(
    state.users.map((user) => [user.id, Object.fromEntries(state.islands.map((island) => [island.id, null])) as Record<string, -1 | 0 | 1 | null>])
  );
  for (const event of events) {
    const userRatings = ratingsByUser.get(event.userId);
    if (userRatings) {
      userRatings[event.islandId] = event.rating;
    }
  }
  const visibleUsers = state.users.map((user) => ({ ...user, ratings: ratingsByUser.get(user.id) ?? user.ratings }));
  const inferenceByUser = new Map(visibleUsers.map((user) => [user.id, computeInference(user, state.cohorts, state.allTags, state.islands)]));
  const raterSignals = buildRaterSignalProfiles(visibleUsers, inferenceByUser, state.cohorts);
  const affinity = buildIslandAffinityReports(events, raterSignals.byUserId, state.cohorts, state.islands);

  const inferenceValues = Array.from(inferenceByUser.values());
  const playerConfidence = clamp01(
    mean(
      inferenceValues.map((inf) => {
        const diagnosisType = inf.diagnosis.type;
        const diagnosisWeight =
          diagnosisType === 'HIGH_SIGNAL' || diagnosisType === 'MISMATCH_RETAG' || diagnosisType === 'INVERSE_PROFILE'
            ? 1
            : diagnosisType === 'LOW_SIGNAL'
              ? 0.4
              : 0.15;
        const evidenceGate = inf.ratingEvidence;
        if (evidenceGate <= 0) {
          return 0;
        }
        return clamp01(evidenceGate * ((Math.max(0, inf.behaviorTop.score) * 0.55) + (diagnosisWeight * 0.45)));
      })
    )
  );

  const affinityReports = Array.from(affinity.byIslandId.values());
  const islandConfMean = mean(affinityReports.map((r) => mean(r.estimates.map((e) => e.confidence))));
  const islandEvidence = clamp01(mean(affinityReports.map((r) => Math.min(1, r.estimates.reduce((s, e) => s + e.rawCount, 0) / Math.max(1, users)))));
  const islandConfidence = clamp01((islandConfMean * 0.7) + (islandEvidence * 0.3));

  const cohortConfidence = clamp01(
    mean(
      inferenceValues.map((inf) => {
        const knownTop = inf.behaviorTop.cohortId !== null ? inf.behaviorTop.score : 0;
        const specificity = inf.behaviorSpecificity;
        const evidence = inf.ratingEvidence;
        return clamp01((knownTop * 0.45) + (specificity * 0.35) + (evidence * 0.2));
      })
    )
  );

  // Weak proxy: tag confidence reflects interpretability of declared tags against observed evidence, not raw tag volume.
  const tagCoherence = clamp01(mean(inferenceValues.map((inf) => Math.max(0, inf.signalFit))));
  const tagConfidence = clamp01((tagCoherence * 0.6) + (tagDensity * 0.15) + (playerConfidence * 0.25));
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

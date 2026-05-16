import type { SimulationState } from '../model/simulation.js';
import { computeInference } from '../model/inference.js';
import { buildRaterSignalProfiles } from '../model/raterSignal.js';
import { buildIslandAffinityReports } from '../model/affinity.js';
import { getPlayerDiagnosisWeight, SYSTEM_HEALTH_FORMULA_SPEC } from './systemHealthFormulas.js';

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
  const playerCoverage = clamp01(
    (ratingsPerUserCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.player.ratingsPerUserWeight) +
      (progress * SYSTEM_HEALTH_FORMULA_SPEC.coverage.player.progressWeight)
  );
  const islandCoverage = clamp01(
    ((ratedIslands / islands) * SYSTEM_HEALTH_FORMULA_SPEC.coverage.island.ratedIslandsWeight) +
      ((routedIslands / islands) * SYSTEM_HEALTH_FORMULA_SPEC.coverage.island.routedIslandsWeight)
  );
  const cohortCoverage = state.cohorts.length
    ? mean(state.cohorts.map((c) => clamp01(events.filter((e) => (e.raterSignalWeights[c.id] ?? 0) > 0).length / Math.max(1, events.length))))
    : 0;
  const tagDensity = clamp01(mean(state.users.map((u) => u.declaredTags.length)) / tags);
  const tagCoverage = clamp01(
    (tagDensity * SYSTEM_HEALTH_FORMULA_SPEC.coverage.tag.tagDensityWeight) +
      (ratingsPerUserCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.tag.ratingsCoverageWeight)
  );
  const systemCoverage = clamp01(
    (playerCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.composite[0].weight) +
      (islandCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.composite[1].weight) +
      (cohortCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.composite[2].weight) +
      (tagCoverage * SYSTEM_HEALTH_FORMULA_SPEC.coverage.composite[3].weight)
  );

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
        const diagnosisWeight = getPlayerDiagnosisWeight(inf.diagnosis.type);
        const evidenceGate = inf.ratingEvidence;
        if (evidenceGate <= 0) {
          return 0;
        }
        return clamp01(
          evidenceGate *
            ((Math.max(0, inf.behaviorTop.score) * SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.behaviorScoreWeight) +
              (diagnosisWeight * SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeight))
        );
      })
    )
  );

  const affinityReports = Array.from(affinity.byIslandId.values());
  const islandConfMean = mean(affinityReports.map((r) => mean(r.estimates.map((e) => e.confidence))));
  const islandEvidence = clamp01(mean(affinityReports.map((r) => Math.min(1, r.estimates.reduce((s, e) => s + e.rawCount, 0) / Math.max(1, users)))));
  const islandConfidence = clamp01(
    (islandConfMean * SYSTEM_HEALTH_FORMULA_SPEC.confidence.island.affinityConfidenceWeight) +
      (islandEvidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.island.affinityEvidenceWeight)
  );

  const cohortConfidence = clamp01(
    mean(
      inferenceValues.map((inf) => {
        const knownTop = inf.behaviorTop.cohortId !== null ? inf.behaviorTop.score : 0;
        const specificity = inf.behaviorSpecificity;
        const evidence = inf.ratingEvidence;
        return clamp01(
          (knownTop * SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.knownTopWeight) +
            (specificity * SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.specificityWeight) +
            (evidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.cohort.evidenceWeight)
        );
      })
    )
  );

  // Weak proxy: tag confidence reflects interpretability of declared tags against observed evidence, not raw tag volume.
  const tagCoherence = clamp01(mean(inferenceValues.map((inf) => Math.max(0, inf.signalFit))));
  const tagConfidence = clamp01(
    (tagCoherence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.tagCoherenceWeight) +
      (tagDensity * SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.tagDensityWeight) +
      (playerConfidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.tag.playerConfidenceWeight)
  );
  const systemConfidence = clamp01(
    (playerConfidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.composite[0].weight) +
      (islandConfidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.composite[1].weight) +
      (cohortConfidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.composite[2].weight) +
      (tagConfidence * SYSTEM_HEALTH_FORMULA_SPEC.confidence.composite[3].weight)
  );

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

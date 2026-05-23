import type { ObservedBehaviorEvent } from './observedBehavior.js';
import type { RatingEventSource } from './simulation.js';
import type { CohortAnchor, CohortId, Island, IslandId, Rating, UserId } from './types.js';
import type { RaterSignalProfile } from './raterSignal.js';

export interface IslandCohortRatingState {
  turn: number;
  islandId: IslandId;
  cohortId: CohortId;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  affinity: number;
  confidence: number;
  uncertainty: number;
  effectiveWeight: number;
  evidenceCount: number;
  lastUpdatedTurn: number;
  version: 1;
}

export interface IslandCohortRatingTurnEvidence {
  turn: number;
  primaryEvidenceMean: number;
  primaryEvidenceWeight: number;
  behaviorSupport: number;
  evidenceCount: number;
}

export interface IslandCohortRatingRatingEvent {
  id: string;
  turn: number;
  userId: UserId;
  islandId: IslandId;
  rating: Rating;
  source: RatingEventSource;
  raterSignalWeights: Readonly<Record<CohortId, number>>;
}

export interface BuildIslandCohortRatingSnapshotsInput {
  islands: readonly Island[];
  cohorts: readonly CohortAnchor[];
  ratingEvents: readonly IslandCohortRatingRatingEvent[];
  turnHistory: readonly { turn: number }[];
  observedBehaviorEvents?: readonly ObservedBehaviorEvent[];
  signalProfiles?: ReadonlyMap<UserId, RaterSignalProfile>;
}

export interface BuildIslandCohortRatingSnapshotsForTurnInput {
  islands: readonly Island[];
  cohorts: readonly CohortAnchor[];
  turn: number;
  ratingEvents: readonly IslandCohortRatingRatingEvent[];
  previousSnapshots: readonly IslandCohortRatingState[];
  observedBehaviorEvents?: readonly ObservedBehaviorEvent[];
  signalProfiles?: ReadonlyMap<UserId, RaterSignalProfile>;
}

const MIN_RD = 0.08;
const MAX_RD = 1;
const MIN_VOLATILITY = 0.02;
const MAX_VOLATILITY = 0.35;
const BEHAVIOR_INFLUENCE = 0.12;
const MISSING_EVIDENCE_RD_BOOST = 0.02;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) {
    return 1;
  }
  if (value < 0) {
    return -1;
  }
  return 0;
}

function behaviorPolarity(kind: ObservedBehaviorEvent['kind']): -1 | 0 | 1 {
  switch (kind) {
    case 'completion':
    case 'replay':
    case 'return':
      return 1;
    case 'bounce':
    case 'abandon':
      return -1;
    default:
      return 0;
  }
}

function createBlankState(islandId: IslandId, cohortId: CohortId): IslandCohortRatingState {
  return {
    turn: -1,
    islandId,
    cohortId,
    rating: 0,
    ratingDeviation: 1,
    volatility: 0.08,
    affinity: 0,
    confidence: 0,
    uncertainty: 1,
    effectiveWeight: 0,
    evidenceCount: 0,
    lastUpdatedTurn: -1,
    version: 1
  };
}

export function createIslandCohortRatingState(input: { islandId: IslandId; cohortId: CohortId }): IslandCohortRatingState {
  return createBlankState(input.islandId, input.cohortId);
}

export function softResetIslandCohortRatingState(
  state: IslandCohortRatingState,
  options: { ratingDeviationBoost?: number; volatilityBoost?: number } = {}
): IslandCohortRatingState {
  const ratingDeviationBoost = options.ratingDeviationBoost ?? 0.24;
  const volatilityBoost = options.volatilityBoost ?? 0.03;

  const ratingDeviation = clamp(state.ratingDeviation + ratingDeviationBoost, MIN_RD, MAX_RD);
  const volatility = clamp(state.volatility + volatilityBoost, MIN_VOLATILITY, MAX_VOLATILITY);
  const confidence = clamp01(1 - ratingDeviation);

  return {
    ...state,
    turn: state.turn,
    ratingDeviation,
    volatility,
    confidence,
    uncertainty: 1 - confidence,
    affinity: clamp(state.rating, -1, 1),
    effectiveWeight: state.effectiveWeight,
    lastUpdatedTurn: state.lastUpdatedTurn,
    version: 1
  };
}

export function advanceIslandCohortRatingState(
  previous: IslandCohortRatingState,
  evidence: IslandCohortRatingTurnEvidence
): IslandCohortRatingState {
  const turnWeight = clamp01(evidence.primaryEvidenceWeight);
  const evidenceStrength = clamp01(turnWeight / (turnWeight + 4));
  const behaviorInfluence = clamp(evidence.behaviorSupport * BEHAVIOR_INFLUENCE, -BEHAVIOR_INFLUENCE, BEHAVIOR_INFLUENCE);
  const targetRating = clamp(evidence.primaryEvidenceMean + behaviorInfluence, -1, 1);
  const movementScale = clamp01(previous.ratingDeviation + previous.volatility * 0.5);
  const nextRating = clamp(
    previous.rating + (targetRating - previous.rating) * evidenceStrength * movementScale,
    -1,
    1
  );

  const previousDirection = sign(previous.rating);
  const targetDirection = sign(targetRating);
  const alignment = previousDirection === 0 || targetDirection === 0 ? 0 : previousDirection === targetDirection ? 1 : -1;
  const contradiction = alignment < 0 ? 1 : 0;
  const consistency = alignment > 0 ? 1 : 0;
  const noEvidence = evidence.primaryEvidenceWeight <= 0;

  const ratingDeviation = clamp(
    previous.ratingDeviation +
      (noEvidence ? MISSING_EVIDENCE_RD_BOOST : 0) -
      evidenceStrength * 0.28 +
      contradiction * 0.11 -
      consistency * 0.04,
    MIN_RD,
    MAX_RD
  );

  const volatility = clamp(
    previous.volatility +
      contradiction * 0.06 +
      (evidence.behaviorSupport < 0 ? 0.02 : 0) -
      consistency * 0.03 -
      (evidence.behaviorSupport > 0 ? 0.01 : 0),
    MIN_VOLATILITY,
    MAX_VOLATILITY
  );

  const confidence = clamp01(1 - ratingDeviation);

  return {
    ...previous,
    turn: evidence.turn,
    rating: nextRating,
    ratingDeviation,
    volatility,
    affinity: nextRating,
    confidence,
    uncertainty: 1 - confidence,
    effectiveWeight: previous.effectiveWeight + evidence.primaryEvidenceWeight,
    evidenceCount: previous.evidenceCount + evidence.evidenceCount,
    lastUpdatedTurn: evidence.turn,
    version: 1
  };
}

interface AggregatedTurnEvidence {
  primaryEvidenceMean: number;
  primaryEvidenceWeight: number;
  behaviorSupport: number;
  evidenceCount: number;
}

function ensureTurnList(turnHistory: readonly { turn: number }[], ratingEvents: readonly IslandCohortRatingRatingEvent[]): number[] {
  const turns = turnHistory.length > 0
    ? turnHistory.map((entry) => entry.turn)
    : Array.from(new Set(ratingEvents.map((event) => event.turn)));

  return Array.from(new Set(turns)).sort((left, right) => left - right);
}

function buildBehaviorLookup(
  observedBehaviorEvents: readonly ObservedBehaviorEvent[] | undefined
): ReadonlyMap<string, ObservedBehaviorEvent> {
  return new Map((observedBehaviorEvents ?? []).map((event) => [event.sourceRatingEventId, event]));
}

function buildTrustWeightForEvent(
  event: IslandCohortRatingRatingEvent,
  cohortId: CohortId,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile> | undefined
): number {
  const explicitWeight = event.raterSignalWeights[cohortId];
  if (typeof explicitWeight === 'number' && Number.isFinite(explicitWeight)) {
    return Math.max(0, explicitWeight);
  }

  const profileWeight = signalProfiles?.get(event.userId)?.cohortWeights[cohortId] ?? 0;
  return Math.max(0, profileWeight);
}

function aggregateTurnEvidence(
  turn: number,
  islandId: IslandId,
  cohortId: CohortId,
  events: readonly IslandCohortRatingRatingEvent[],
  behaviorLookup: ReadonlyMap<string, ObservedBehaviorEvent>,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile> | undefined
): AggregatedTurnEvidence {
  let weightedRatingSum = 0;
  let primaryEvidenceWeight = 0;
  let behaviorSupportSum = 0;
  let behaviorSupportWeight = 0;
  let evidenceCount = 0;

  for (const event of events) {
    if (event.turn !== turn || event.islandId !== islandId) {
      continue;
    }

    const trustWeight = buildTrustWeightForEvent(event, cohortId, signalProfiles);
    if (trustWeight <= 0) {
      continue;
    }

    const behavior = behaviorLookup.get(event.id);
    const behaviorAgreement = behavior ? event.rating * behaviorPolarity(behavior.kind) : 0;
    const eventWeight = trustWeight;

    weightedRatingSum += event.rating * eventWeight;
    primaryEvidenceWeight += eventWeight;
    behaviorSupportSum += behaviorAgreement * eventWeight;
    behaviorSupportWeight += eventWeight;
    evidenceCount += 1;
  }

  return {
    primaryEvidenceMean: primaryEvidenceWeight > 0 ? weightedRatingSum / primaryEvidenceWeight : 0,
    primaryEvidenceWeight,
    behaviorSupport: behaviorSupportWeight > 0 ? behaviorSupportSum / behaviorSupportWeight : 0,
    evidenceCount
  };
}

function aggregateTurnEvidenceForPair(
  turn: number,
  islandId: IslandId,
  cohortId: CohortId,
  events: readonly IslandCohortRatingRatingEvent[],
  behaviorLookup: ReadonlyMap<string, ObservedBehaviorEvent>,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile> | undefined
): AggregatedTurnEvidence {
  return aggregateTurnEvidence(turn, islandId, cohortId, events, behaviorLookup, signalProfiles);
}

export function buildIslandCohortRatingSnapshots(
  input: BuildIslandCohortRatingSnapshotsInput
): IslandCohortRatingState[] {
  const turns = ensureTurnList(input.turnHistory, input.ratingEvents);
  const behaviorLookup = buildBehaviorLookup(input.observedBehaviorEvents);
  const latestByPair = new Map<string, IslandCohortRatingState>();
  const snapshots: IslandCohortRatingState[] = [];

  for (const turn of turns) {
    for (const island of input.islands) {
      for (const cohort of input.cohorts) {
        const pairKey = `${island.id}:${cohort.id}`;
        const previous = latestByPair.get(pairKey) ?? createBlankState(island.id, cohort.id);
        const turnEvidence = aggregateTurnEvidence(
          turn,
          island.id,
          cohort.id,
          input.ratingEvents,
          behaviorLookup,
          input.signalProfiles
        );

        const nextState = advanceIslandCohortRatingState(previous, {
          turn,
          ...turnEvidence
        });
        latestByPair.set(pairKey, nextState);
        snapshots.push({ ...nextState });
      }
    }
  }

  return snapshots;
}

export function buildIslandCohortRatingSnapshotsForTurn(
  input: BuildIslandCohortRatingSnapshotsForTurnInput
): IslandCohortRatingState[] {
  const behaviorLookup = buildBehaviorLookup(input.observedBehaviorEvents);
  const previousByPair = new Map<string, IslandCohortRatingState>(
    input.previousSnapshots.map((snapshot) => [`${snapshot.islandId}:${snapshot.cohortId}`, snapshot])
  );
  const nextSnapshots: IslandCohortRatingState[] = [];

  for (const island of input.islands) {
    for (const cohort of input.cohorts) {
      const pairKey = `${island.id}:${cohort.id}`;
      const previous = previousByPair.get(pairKey) ?? createBlankState(island.id, cohort.id);
      const turnEvidence = aggregateTurnEvidenceForPair(
        input.turn,
        island.id,
        cohort.id,
        input.ratingEvents,
        behaviorLookup,
        input.signalProfiles
      );
      const nextState = advanceIslandCohortRatingState(previous, {
        turn: input.turn,
        ...turnEvidence
      });
      nextSnapshots.push({ ...nextState });
    }
  }

  return nextSnapshots;
}

export function indexIslandCohortRatingSnapshots(
  snapshots: readonly IslandCohortRatingState[]
): ReadonlyMap<IslandId, Map<CohortId, IslandCohortRatingState>> {
  const byIslandId = new Map<IslandId, Map<CohortId, IslandCohortRatingState>>();

  for (const snapshot of snapshots) {
    const islandMap = byIslandId.get(snapshot.islandId) ?? new Map<CohortId, IslandCohortRatingState>();
    const existing = islandMap.get(snapshot.cohortId);

    if (!existing || snapshot.turn >= existing.turn) {
      islandMap.set(snapshot.cohortId, { ...snapshot });
      byIslandId.set(snapshot.islandId, islandMap);
    }
  }

  return byIslandId;
}

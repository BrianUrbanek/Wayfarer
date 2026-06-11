import type { ObservedBehaviorEvent } from './observedBehavior.js';
import type { RatingEventSource, RatingRefreshEvent } from './simulation.js';
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
  support: number;
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
  splitPressure: number;
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
  refreshEvents?: readonly RatingRefreshEvent[];
  observedBehaviorEvents?: readonly ObservedBehaviorEvent[];
  signalProfiles?: ReadonlyMap<UserId, RaterSignalProfile>;
}

export interface BuildIslandCohortRatingSnapshotsForTurnInput {
  islands: readonly Island[];
  cohorts: readonly CohortAnchor[];
  turn: number;
  ratingEvents: readonly IslandCohortRatingRatingEvent[];
  previousSnapshots: readonly IslandCohortRatingState[];
  refreshEvents?: readonly RatingRefreshEvent[];
  observedBehaviorEvents?: readonly ObservedBehaviorEvent[];
  signalProfiles?: ReadonlyMap<UserId, RaterSignalProfile>;
}

const MIN_RD = 0.08;
const MAX_RD = 1;
const MIN_VOLATILITY = 0.02;
const MAX_VOLATILITY = 0.35;
const BEHAVIOR_INFLUENCE = 0.12;
const SUPPORT_EVIDENCE_WEIGHT = 1.1;
const SUPPORT_MATURITY = 6;
const SUPPORT_RD_MULTIPLIER = 0.9;
const CONVERGENCE_WEIGHT = 0.7;
const PRIOR_RD_BLEND = 0.02;
const CONTRADICTION_RD_BOOST = 0.16;
const CONTRADICTION_VOLATILITY_BOOST = 0.08;
const CONSISTENT_VOLATILITY_SHRINK = 0.025;
const REFRESH_RD_BOOST = 0.24;

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
    support: 0,
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
    support: state.support,
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
  const turnWeight = Math.max(0, evidence.primaryEvidenceWeight);
  const noEvidence = evidence.primaryEvidenceWeight <= 0;
  if (noEvidence) {
    return {
      ...previous,
      turn: evidence.turn,
      version: 1
    };
  }

  const supportGain = turnWeight * SUPPORT_EVIDENCE_WEIGHT;
  const nextSupport = previous.support + supportGain;
  const priorSupportDamping = clamp01(SUPPORT_MATURITY / (SUPPORT_MATURITY + previous.support));
  const nextSupportDamping = clamp01(SUPPORT_MATURITY / (SUPPORT_MATURITY + nextSupport));
  const evidenceStrength = clamp01(turnWeight / (turnWeight + 1.5)) * priorSupportDamping;
  const behaviorInfluence = clamp(evidence.behaviorSupport * BEHAVIOR_INFLUENCE, -BEHAVIOR_INFLUENCE, BEHAVIOR_INFLUENCE);
  const targetRating = clamp(evidence.primaryEvidenceMean + behaviorInfluence, -1, 1);
  const movementScale = clamp01(previous.ratingDeviation + previous.volatility * 0.35 + priorSupportDamping * CONVERGENCE_WEIGHT);
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
  const contradictionPressure = contradiction * clamp01(previous.confidence + previous.ratingDeviation * 0.5 + turnWeight);
  const consistencyPressure = consistency * clamp01(previous.ratingDeviation + nextSupportDamping);
  const splitPressure = clamp01((evidence.splitPressure ?? 0) * clamp01(previous.confidence + priorSupportDamping));
  const supportDerivedRD = clamp01(1 / (1 + nextSupport * SUPPORT_RD_MULTIPLIER));

  const ratingDeviation = clamp(
    supportDerivedRD * (1 - PRIOR_RD_BLEND) + previous.ratingDeviation * PRIOR_RD_BLEND +
      splitPressure * 0.08 +
      contradictionPressure * CONTRADICTION_RD_BOOST -
      consistencyPressure * 0.005,
    MIN_RD,
    MAX_RD
  );

  const volatility = clamp(
    previous.volatility +
      splitPressure * 0.06 +
      contradictionPressure * CONTRADICTION_VOLATILITY_BOOST +
      (evidence.behaviorSupport < 0 ? 0.02 : 0) -
      consistencyPressure * CONSISTENT_VOLATILITY_SHRINK -
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
    support: nextSupport,
    effectiveWeight: previous.effectiveWeight + evidence.primaryEvidenceWeight,
    evidenceCount: previous.evidenceCount + evidence.evidenceCount,
    lastUpdatedTurn: noEvidence ? previous.lastUpdatedTurn : evidence.turn,
    version: 1
  };
}

interface AggregatedTurnEvidence {
  primaryEvidenceMean: number;
  primaryEvidenceWeight: number;
  behaviorSupport: number;
  splitPressure: number;
  evidenceCount: number;
}

function ensureTurnList(
  turnHistory: readonly { turn: number }[],
  ratingEvents: readonly IslandCohortRatingRatingEvent[],
  refreshEvents: readonly RatingRefreshEvent[] | undefined
): number[] {
  const turns = [
    ...turnHistory.map((entry) => entry.turn),
    ...ratingEvents.map((event) => event.turn),
    ...(refreshEvents ?? []).map((event) => event.turn)
  ];

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
  let ratingMagnitudeSum = 0;
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
    ratingMagnitudeSum += Math.abs(event.rating) * eventWeight;
    evidenceCount += 1;
  }

  const primaryEvidenceMean = primaryEvidenceWeight > 0 ? weightedRatingSum / primaryEvidenceWeight : 0;
  const splitPressure = primaryEvidenceWeight > 0
    ? clamp01(ratingMagnitudeSum / primaryEvidenceWeight - Math.abs(primaryEvidenceMean))
    : 0;

  return {
    primaryEvidenceMean,
    primaryEvidenceWeight,
    behaviorSupport: behaviorSupportWeight > 0 ? behaviorSupportSum / behaviorSupportWeight : 0,
    splitPressure,
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

function refreshEventsForTurn(
  refreshEvents: readonly RatingRefreshEvent[] | undefined,
  turn: number
): readonly RatingRefreshEvent[] {
  return (refreshEvents ?? []).filter((event) => event.turn === turn);
}

function hasRefreshForIsland(
  refreshEvents: readonly RatingRefreshEvent[],
  islandId: IslandId
): boolean {
  return refreshEvents.some((event) => event.kind === 'gamePatch' || (event.kind === 'islandUpdate' && event.islandId === islandId));
}

function resetForRefresh(
  previous: IslandCohortRatingState,
  turnRefreshEvents: readonly RatingRefreshEvent[],
  islandId: IslandId
): IslandCohortRatingState {
  if (!hasRefreshForIsland(turnRefreshEvents, islandId)) {
    return previous;
  }

  return softResetIslandCohortRatingState(previous, {
    ratingDeviationBoost: REFRESH_RD_BOOST,
    volatilityBoost: 0
  });
}

export function buildIslandCohortRatingSnapshots(
  input: BuildIslandCohortRatingSnapshotsInput
): IslandCohortRatingState[] {
  const turns = ensureTurnList(input.turnHistory, input.ratingEvents, input.refreshEvents);
  const behaviorLookup = buildBehaviorLookup(input.observedBehaviorEvents);
  const latestByPair = new Map<string, IslandCohortRatingState>();
  const snapshots: IslandCohortRatingState[] = [];

  for (const turn of turns) {
    const turnRefreshEvents = refreshEventsForTurn(input.refreshEvents, turn);
    for (const island of input.islands) {
      for (const cohort of input.cohorts) {
        const pairKey = `${island.id}:${cohort.id}`;
        const previous = resetForRefresh(latestByPair.get(pairKey) ?? createBlankState(island.id, cohort.id), turnRefreshEvents, island.id);
        const turnEvidence = aggregateTurnEvidence(
          turn,
          island.id,
          cohort.id,
          input.ratingEvents,
          behaviorLookup,
          input.signalProfiles
        );
        const nextState =
          turnEvidence.primaryEvidenceWeight <= 0
            ? {
                ...previous,
                turn,
                version: 1 as const
              }
            : advanceIslandCohortRatingState(previous, {
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
  const turnRefreshEvents = refreshEventsForTurn(input.refreshEvents, input.turn);

  for (const island of input.islands) {
    for (const cohort of input.cohorts) {
      const pairKey = `${island.id}:${cohort.id}`;
      const previous = resetForRefresh(previousByPair.get(pairKey) ?? createBlankState(island.id, cohort.id), turnRefreshEvents, island.id);
      const turnEvidence = aggregateTurnEvidenceForPair(
        input.turn,
        island.id,
        cohort.id,
        input.ratingEvents,
        behaviorLookup,
        input.signalProfiles
      );
      const nextState =
        turnEvidence.primaryEvidenceWeight <= 0
          ? {
              ...previous,
              turn: input.turn,
              version: 1 as const
            }
          : advanceIslandCohortRatingState(previous, {
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

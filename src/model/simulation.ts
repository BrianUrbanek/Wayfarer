import { analyzePseudoCohorts, type PseudoCohortAnalysis } from './pseudoCohorts.js';
import { analyzeReviewerArchetypes, type ReviewerArchetypeAnalysis } from './reviewerArchetypes.js';
import { computeInference } from './inference.js';
import { buildIslandAffinityReports, type IslandAffinityReport } from './affinity.js';
import {
  buildIslandCohortRatingSnapshots,
  buildIslandCohortRatingSnapshotsForTurn,
  type IslandCohortRatingState
} from './islandCohortRating.js';
import {
  buildObservedBehaviorEvents,
  type ObservedBehaviorEvent
} from './observedBehavior.js';
import {
  buildEvidenceEpochState,
  compareEvidenceEpoch,
  createInitialEpoch,
  createInitialEvidenceEpoch,
  getCurrentEpochForIsland,
  type EvidenceEpochState
} from './evidenceEpoch.js';
import { buildRaterSignalProfiles, type RaterSignalProfile } from './raterSignal.js';
import {
  recommendIslandsForUser,
  type RecommendationOptions,
  type RecommendationKind
} from './recommendations.js';
import { createSeededRandom, type SeededRng } from '../generator/seededRandom.js';
import {
  resolveRatingCount,
  resolveRoutingRiskProfileValues,
  selectParticipatingUsers,
  normalizeHeartbeatPolicy,
  type ParticipationModel,
  type RatingCountModel,
  type HeartbeatPolicy,
  type HeartbeatCadenceProfile,
  type RoutingRiskProfile,
  type TurnMode
} from './turnPolicy.js';
import type { HiddenTasteCohort } from './types.js';
import type { SupportedDiceExpression } from './dice.js';
import type {
  CohortAnchor,
  CohortId,
  DiagnosisType,
  EvidenceEpoch,
  InferredRatingEvidenceRecord,
  Island,
  IslandId,
  MaybeRating,
  Rating,
  TagId,
  User,
  UserId
} from './types.js';

export type RatingEventSource = 'organic' | 'guided';

export type RatingRevisionReason = 'playerChangedMind' | 'gamePatchRefresh' | 'islandUpdateRefresh';

export type RatingRefreshEventKind = 'gamePatch' | 'islandUpdate';

export interface RatingRefreshEvent {
  readonly id: string;
  readonly turn: number;
  readonly kind: RatingRefreshEventKind;
  readonly islandId?: IslandId;
  readonly reason?: string;
}

export interface RatingEvent {
  readonly id: string;
  readonly turn: number;
  readonly userId: UserId;
  readonly islandId: IslandId;
  readonly rating: Rating;
  readonly source: RatingEventSource;
  readonly raterSignalWeights: Record<CohortId, number>;
  readonly revisionReason?: RatingRevisionReason;
  readonly supersedesEventId?: string;
  readonly epoch?: EvidenceEpoch;
  readonly islandVersionId?: string;
  readonly gameRulesVersionId?: string;
}

export interface IslandCohortConfidenceSnapshot {
  turn: number;
  islandId: IslandId;
  cohortId: CohortId;
  affinity: number;
  confidence: number;
  effectiveWeight: number;
  rawCount: number;
}

export interface SimulationTurnSummary {
  turn: number;
  mode: 'organic' | 'guided' | 'mixed';
  participatingUserIds: UserId[];
  ratingsCreated: number;
  organicRatingsCreated: number;
  guidedRatingsCreated: number;
  refreshEventsCreated?: number;
  gamePatchRefreshEventsCreated?: number;
  islandUpdateRefreshEventsCreated?: number;
  newlyRatedIslandIds: IslandId[];
  routedIslandIds: IslandId[];
  recommendationKinds: Record<RecommendationKind, number>;
  diagnosisCounts: Record<DiagnosisType, number>;
}

export interface SimulationState {
  seed: number;
  currentTurn: number;
  allTags: TagId[];
  latentUsers: User[];
  users: User[];
  cohorts: CohortAnchor[];
  islands: Island[];
  hiddenTasteCohorts: HiddenTasteCohort[];
  ratingEvents: RatingEvent[];
  inferredRatingEvidence: InferredRatingEvidenceRecord[];
  refreshEvents: RatingRefreshEvent[];
  currentWorldEpoch: number;
  islandEpochById: Record<IslandId, number>;
  observedBehaviorEvents: ObservedBehaviorEvent[];
  islandCohortRatingSnapshots: IslandCohortRatingState[];
  confidenceSnapshots: IslandCohortConfidenceSnapshot[];
  inferenceByUserId: ReadonlyMap<UserId, ReturnType<typeof computeInference>>;
  raterSignalProfiles: ReadonlyMap<UserId, RaterSignalProfile>;
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>;
  pseudoCohortAnalysis: PseudoCohortAnalysis;
  reviewerArchetypeAnalysis: ReviewerArchetypeAnalysis;
  turnHistory: SimulationTurnSummary[];
}

export interface SerializedSimulationState {
  seed: number;
  currentTurn: number;
  allTags: TagId[];
  latentUsers: User[];
  cohorts: CohortAnchor[];
  islands: Island[];
  hiddenTasteCohorts?: HiddenTasteCohort[];
  ratingEvents: RatingEvent[];
  inferredRatingEvidence?: InferredRatingEvidenceRecord[];
  refreshEvents?: RatingRefreshEvent[];
  currentWorldEpoch?: number;
  islandEpochById?: Record<IslandId, number>;
  observedBehaviorEvents?: ObservedBehaviorEvent[];
  islandCohortRatingSnapshots?: IslandCohortRatingState[];
  confidenceSnapshots?: IslandCohortConfidenceSnapshot[];
  turnHistory: SimulationTurnSummary[];
}

export interface SimulationBootstrapConfig {
  seed: number;
  allTags: TagId[];
  latentUsers: User[];
  cohorts: CohortAnchor[];
  islands: Island[];
  hiddenTasteCohorts?: HiddenTasteCohort[];
  initialRatingsPerUser: number;
}

export interface AdvancePolicyTurnConfig {
  turnMode: TurnMode;
  participationModel: ParticipationModel;
  participatingUsersPerTurn: number;
  participationChance: number;
  organicRatingCountModel: RatingCountModel;
  organicRatingsPerUser: number;
  organicRatingDice: SupportedDiceExpression;
  guidedRatingCountModel: RatingCountModel;
  guidedRecommendationsPerUser: number;
  guidedRecommendationDice: SupportedDiceExpression;
  routingRiskProfile: RoutingRiskProfile;
  customExplorationWeight: number;
  customBadFitGuardThreshold: number;
  heartbeat?: HeartbeatPolicy;
}

function buildBlankRatings(islands: readonly Island[]): Record<IslandId, MaybeRating> {
  return Object.fromEntries(islands.map((island) => [island.id, null])) as Record<IslandId, MaybeRating>;
}

function cloneUserWithRatings(user: User, ratings: Record<IslandId, MaybeRating>): User {
  return {
    ...user,
    declaredTags: user.declaredTags.slice(),
    ratings: { ...ratings }
  };
}

function eventId(turn: number, userId: UserId, islandId: IslandId): string {
  return `${turn}:${userId}:${islandId}`;
}

function pairKey(userId: UserId, islandId: IslandId): string {
  return `${userId}:${islandId}`;
}

function latestHistoricalRatingEvent(
  events: readonly RatingEvent[],
  userId: UserId,
  islandId: IslandId
): RatingEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.userId === userId && event.islandId === islandId) {
      return event;
    }
  }

  return null;
}

function normalizeRatingEventEpochs(events: readonly RatingEvent[]): RatingEvent[] {
  return events.map((event) => ({
    ...event,
    epoch: event.epoch ? { ...event.epoch } : createInitialEpoch(),
    raterSignalWeights: { ...event.raterSignalWeights }
  }));
}

function resolveRevisionReason(
  previousEvent: RatingEvent | null,
  nextEvent: { rating: Rating; source: RatingEventSource; islandVersionId: string; gameRulesVersionId: string; epoch?: EvidenceEpoch }
): RatingRevisionReason | null {
  if (!previousEvent) {
    return null;
  }

  if (previousEvent.epoch && nextEvent.epoch) {
    const freshness = compareEvidenceEpoch(previousEvent.epoch, nextEvent.epoch);
    if (freshness === 'prior-world-context') {
      return 'gamePatchRefresh';
    }
    if (freshness === 'prior-island-context') {
      return 'islandUpdateRefresh';
    }
    if (previousEvent.rating !== nextEvent.rating) {
      return 'playerChangedMind';
    }
    return null;
  }

  if (previousEvent.gameRulesVersionId !== nextEvent.gameRulesVersionId) {
    return 'gamePatchRefresh';
  }

  if (previousEvent.islandVersionId !== nextEvent.islandVersionId) {
    return 'islandUpdateRefresh';
  }

  if (previousEvent.rating !== nextEvent.rating) {
    return 'playerChangedMind';
  }

  return null;
}

function globalVersionIdForTurn(turn: number): string {
  return `game-rules-v${turn}`;
}

function islandVersionIdForTurn(turn: number, islandId: IslandId): string {
  return `island:${islandId}:v${turn}`;
}

function buildInitialRatingVersions(islands: readonly Island[]): { gameRulesVersionId: string; islandVersionById: Record<IslandId, string> } {
  return {
    gameRulesVersionId: 'game-rules-v0',
    islandVersionById: Object.fromEntries(islands.map((island) => [island.id, islandVersionIdForTurn(0, island.id)])) as Record<IslandId, string>
  };
}

function buildCurrentRatingVersions(
  islands: readonly Island[],
  refreshEvents: readonly RatingRefreshEvent[]
): { gameRulesVersionId: string; islandVersionById: Record<IslandId, string> } {
  const versions = buildInitialRatingVersions(islands);

  for (const event of refreshEvents.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id))) {
    if (event.kind === 'gamePatch') {
      versions.gameRulesVersionId = globalVersionIdForTurn(event.turn);
      for (const island of islands) {
        versions.islandVersionById[island.id] = islandVersionIdForTurn(event.turn, island.id);
      }
      continue;
    }

    if (event.kind === 'islandUpdate' && event.islandId) {
      versions.islandVersionById[event.islandId] = islandVersionIdForTurn(event.turn, event.islandId);
    }
  }

  return versions;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function heartbeatTurnSeed(seed: number, turn: number): number {
  return (seed ^ Math.imul(turn + 1, 2654435761)) >>> 0;
}

export function shouldEmitGamePatchForTurn(turn: number, heartbeat: HeartbeatPolicy): boolean {
  if (heartbeat.gamePatchEveryNTurns <= 0) {
    return false;
  }

  return turn >= heartbeat.gamePatchTurnOffset && ((turn - heartbeat.gamePatchTurnOffset) % heartbeat.gamePatchEveryNTurns === 0);
}

export function resolveHeartbeatCadenceProfile(
  seed: number,
  island: Island,
  heartbeat: HeartbeatPolicy
): HeartbeatCadenceProfile {
  if (island.updateCadenceProfile) {
    return island.updateCadenceProfile;
  }

  const weightEntries = Object.entries(heartbeat.islandCadenceProfileWeights) as Array<[HeartbeatCadenceProfile, number]>;
  const totalWeight = weightEntries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  const hashed = hashString(`${seed}:${island.id}:${island.label}`);
  const roll = (hashed % 10000) / 10000;

  if (totalWeight <= 0) {
    return 'steady';
  }

  let cumulative = 0;
  for (const [profile, weight] of weightEntries) {
    cumulative += Math.max(0, weight) / totalWeight;
    if (roll <= cumulative) {
      return profile;
    }
  }

  return 'steady';
}

export function heartbeatPropensity(profile: HeartbeatCadenceProfile): number {
  switch (profile) {
    case 'dormant':
      return 0.02;
    case 'slow':
      return 0.12;
    case 'steady':
      return 0.28;
    case 'active':
      return 0.55;
    case 'frenetic':
      return 0.82;
  }
}

export function buildHeartbeatRefreshEvents(
  state: Pick<SimulationState, 'seed' | 'islands' | 'refreshEvents'>,
  turn: number,
  heartbeat: HeartbeatPolicy
): RatingRefreshEvent[] {
  const refreshEvents: RatingRefreshEvent[] = [];

  if (shouldEmitGamePatchForTurn(turn, heartbeat)) {
    refreshEvents.push({
      id: `heartbeat:gamePatch:${turn}`,
      turn,
      kind: 'gamePatch',
      reason: 'scheduled heartbeat patch'
    });
  }

  const inspectionCap = Math.max(0, heartbeat.maxIslandInspectionsPerTurn);
  const emissionCap = Math.max(0, heartbeat.maxIslandUpdatesPerTurn);
  if (inspectionCap === 0 || emissionCap === 0 || state.islands.length === 0) {
    return refreshEvents;
  }

  const rng = createSeededRandom(heartbeatTurnSeed(state.seed, turn));
  const shuffledIslands = rng.shuffle(state.islands.slice());
  let inspected = 0;
  let emitted = 0;

  for (const island of shuffledIslands) {
    if (inspected >= inspectionCap || emitted >= emissionCap) {
      break;
    }

    inspected += 1;
    const profile = resolveHeartbeatCadenceProfile(state.seed, island, heartbeat);
    const propensity = heartbeatPropensity(profile);
    if (rng.next() >= propensity) {
      continue;
    }

    refreshEvents.push({
      id: `heartbeat:islandUpdate:${turn}:${island.id}`,
      turn,
      kind: 'islandUpdate',
      islandId: island.id,
      reason: `scheduled heartbeat ${profile} island update`
    });
    emitted += 1;
  }

  return refreshEvents;
}

function countHeartbeatRefreshEvents(refreshEvents: readonly RatingRefreshEvent[]): {
  total: number;
  gamePatch: number;
  islandUpdate: number;
} {
  return refreshEvents.reduce(
    (counts, event) => {
      counts.total += 1;
      if (event.kind === 'gamePatch') {
        counts.gamePatch += 1;
      } else if (event.kind === 'islandUpdate') {
        counts.islandUpdate += 1;
      }
      return counts;
    },
    { total: 0, gamePatch: 0, islandUpdate: 0 }
  );
}

function isCurrentRatingEvent(
  event: RatingEvent,
  epochState: EvidenceEpochState
): boolean {
  return compareEvidenceEpoch(event.epoch, getCurrentEpochForIsland(epochState, event.islandId)) === 'current-context';
}

function latestActiveRatingsByPair(
  events: readonly RatingEvent[],
  epochState: EvidenceEpochState
): ReadonlyMap<string, RatingEvent> {
  const superseded = new Set(events.map((event) => event.supersedesEventId).filter((entryId): entryId is string => Boolean(entryId)));
  const active = new Map<string, RatingEvent>();

  for (const event of events) {
    if (!isCurrentRatingEvent(event, epochState) || superseded.has(event.id)) {
      continue;
    }
    const key = pairKey(event.userId, event.islandId);
    const existing = active.get(key);
    if (!existing || existing.turn <= event.turn) {
      active.set(key, event);
    }
  }

  return active;
}

function latestStatedRatingsByPair(events: readonly RatingEvent[]): ReadonlyMap<string, RatingEvent> {
  const superseded = new Set(events.map((event) => event.supersedesEventId).filter((entryId): entryId is string => Boolean(entryId)));
  const latest = new Map<string, RatingEvent>();

  for (const event of events) {
    if (superseded.has(event.id)) {
      continue;
    }
    const key = pairKey(event.userId, event.islandId);
    const existing = latest.get(key);
    if (!existing || existing.turn < event.turn || (existing.turn === event.turn && existing.id.localeCompare(event.id) < 0)) {
      latest.set(key, event);
    }
  }

  return latest;
}

function buildRecommendationCounts(): Record<RecommendationKind, number> {
  return {
    SAFE_FIT: 0,
    SMART_GAMBLE: 0,
    DISCOVERY_PROBE: 0
  };
}

function normalizeRecommendationCounts(counts: Partial<Record<RecommendationKind, number>>): Record<RecommendationKind, number> {
  return {
    ...buildRecommendationCounts(),
    ...counts
  };
}

function buildSignalWeightSnapshot(
  cohorts: readonly CohortAnchor[],
  weightsByCohortId: ReadonlyMap<CohortId, number>,
  defaultWeight: number
): Record<CohortId, number> {
  return Object.fromEntries(
    cohorts.map((cohort) => [cohort.id, weightsByCohortId.get(cohort.id) ?? defaultWeight])
  ) as Record<CohortId, number>;
}

function buildBootstrapSignalWeightSnapshot(cohorts: readonly CohortAnchor[]): Record<CohortId, number> {
  return Object.fromEntries(cohorts.map((cohort) => [cohort.id, 0])) as Record<CohortId, number>;
}

function cloneConfidenceSnapshot(snapshot: IslandCohortConfidenceSnapshot): IslandCohortConfidenceSnapshot {
  return { ...snapshot };
}

function cloneObservedBehaviorEvent(event: ObservedBehaviorEvent): ObservedBehaviorEvent {
  return { ...event };
}

function cloneIslandCohortRatingSnapshot(snapshot: IslandCohortRatingState): IslandCohortRatingState {
  return { ...snapshot };
}

function cloneIsland(island: Island): Island {
  return {
    ...island,
    hiddenAppealPattern: island.hiddenAppealPattern ? { ...island.hiddenAppealPattern } : undefined,
    hiddenAppealVector: island.hiddenAppealVector ? { ...island.hiddenAppealVector } : undefined,
    updateCadenceProfile: island.updateCadenceProfile
  };
}

function cloneHiddenTasteCohort(cohort: HiddenTasteCohort): HiddenTasteCohort {
  return {
    ...cohort,
    tagSignature: cohort.tagSignature.slice(),
    preferenceVector: { ...cohort.preferenceVector }
  };
}

function cloneUsers(users: readonly User[]): User[] {
  return users.map((user) => ({
    ...user,
    declaredTags: user.declaredTags.slice(),
    ratings: { ...user.ratings },
    hiddenTastePreferenceVector: user.hiddenTastePreferenceVector ? { ...user.hiddenTastePreferenceVector } : undefined
  }));
}

function buildConfidenceSnapshotsForTurn(
  turn: number,
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>
): IslandCohortConfidenceSnapshot[] {
  const snapshots: IslandCohortConfidenceSnapshot[] = [];

  for (const report of islandAffinityReports.values()) {
    for (const estimate of report.estimates) {
      snapshots.push({
        turn,
        islandId: report.islandId,
        cohortId: estimate.cohortId,
        affinity: estimate.affinity,
        confidence: estimate.confidence,
        effectiveWeight: estimate.effectiveWeight,
        rawCount: estimate.rawCount
      });
    }
  }

  return snapshots;
}

function deriveHiddenTasteCohortsFromUsers(
  latentUsers: readonly User[],
  seedCohorts: readonly CohortAnchor[]
): HiddenTasteCohort[] {
  const cohortsById = new Map<string, HiddenTasteCohort>();

  for (const user of latentUsers) {
    const cohortId = user.hiddenTasteCohortId;
    const preferenceVector = user.hiddenTastePreferenceVector;
    if (!cohortId || !preferenceVector || cohortsById.has(cohortId)) {
      continue;
    }

    const sourceSeedCohortId = user.hiddenSeedCohortId ?? user.hiddenBehaviorCohortId ?? cohortId;
    const sourceSeedCohort = seedCohorts.find((cohort) => cohort.id === sourceSeedCohortId);
    cohortsById.set(cohortId, {
      id: cohortId,
      label: user.hiddenTasteCohortKind === 'unseeded' ? `Unseeded Hidden ${cohortId}` : sourceSeedCohort?.label ?? cohortId,
      kind: user.hiddenTasteCohortKind ?? 'seed',
      sourceSeedCohortId,
      projectedSeedCohortId: user.hiddenBehaviorCohortId ?? sourceSeedCohortId,
      preferenceVector: { ...preferenceVector },
      tagSignature: Object.entries(preferenceVector)
        .filter(([, value]) => value > 0)
        .map(([tag]) => tag)
    });
  }

  return Array.from(cohortsById.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function buildConfidenceSnapshots(
  latentUsers: readonly User[],
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  ratingEvents: readonly RatingEvent[],
  turnHistory: readonly SimulationTurnSummary[],
  allTags: readonly TagId[],
  refreshEvents: readonly RatingRefreshEvent[] = []
): IslandCohortConfidenceSnapshot[] {
  const uniqueTurns = Array.from(new Set(turnHistory.map((summary) => summary.turn))).sort((left, right) => left - right);
  const snapshots: IslandCohortConfidenceSnapshot[] = [];

  for (const turn of uniqueTurns) {
    const turnEvents = ratingEvents.filter((event) => event.turn <= turn);
    const turnRefreshEvents = refreshEvents.filter((event) => event.turn <= turn);
    const epochState = buildEvidenceEpochState(islands, turnRefreshEvents);
    const activeTurnEvents = Array.from(latestActiveRatingsByPair(turnEvents, epochState).values());
    const visibleUsers = deriveVisibleUsersFromEvents(latentUsers, islands, turnEvents);
    const inferenceByUserId = computeInferenceMap(visibleUsers, cohorts, islands, allTags);
    const signalAnalysis = buildRaterSignalProfiles(visibleUsers, inferenceByUserId, cohorts);
    const affinityAnalysis = buildIslandAffinityReports(activeTurnEvents, signalAnalysis.byUserId, cohorts, islands, {
      refreshEvents: turnRefreshEvents
    });

    for (const report of affinityAnalysis.allReports) {
      for (const estimate of report.estimates) {
        snapshots.push({
          turn,
          islandId: report.islandId,
          cohortId: estimate.cohortId,
          affinity: estimate.affinity,
          confidence: estimate.confidence,
          effectiveWeight: estimate.effectiveWeight,
          rawCount: estimate.rawCount
        });
      }
    }
  }

  return snapshots;
}

export function deriveVisibleUsersFromEvents(
  latentUsers: readonly User[],
  islands: readonly Island[],
  events: readonly RatingEvent[]
): User[] {
  const ratingsByUserId = new Map<UserId, Record<IslandId, MaybeRating>>();
  const activeRatings = latestStatedRatingsByPair(events);

  for (const user of latentUsers) {
    ratingsByUserId.set(user.id, buildBlankRatings(islands));
  }

  for (const event of activeRatings.values()) {
    const ratings = ratingsByUserId.get(event.userId);
    if (!ratings) {
      continue;
    }

    ratings[event.islandId] = event.rating;
  }

  return latentUsers.map((user) => cloneUserWithRatings(user, ratingsByUserId.get(user.id) ?? buildBlankRatings(islands)));
}

function deriveCurrentContextVisibleUsers(
  latentUsers: readonly User[],
  islands: readonly Island[],
  events: readonly RatingEvent[],
  epochState: EvidenceEpochState
): User[] {
  const activeRatings = Array.from(latestActiveRatingsByPair(events, epochState).values());
  return deriveVisibleUsersFromEvents(latentUsers, islands, activeRatings);
}

function computeInferenceMap(
  users: readonly User[],
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  allTags: readonly TagId[]
): ReadonlyMap<UserId, ReturnType<typeof computeInference>> {
  return new Map(
    users.map((user) => [user.id, computeInference(user, cohorts, allTags, islands)])
  );
}

function countDiagnoses(
  inferenceByUserId: ReadonlyMap<UserId, ReturnType<typeof computeInference>>
): Record<DiagnosisType, number> {
  const counts: Record<DiagnosisType, number> = {
    HIGH_SIGNAL: 0,
    MISMATCH_RETAG: 0,
    INVERSE_PROFILE: 0,
    UNKNOWN_OR_NOISY: 0,
    LOW_SIGNAL: 0,
    AMBIGUOUS: 0,
    UNEXPLAINED_PREDICTIVE: 0
  };

  for (const inference of inferenceByUserId.values()) {
    counts[inference.diagnosis.type] += 1;
  }

  return counts;
}

function createRatingEventsForUsers(
  rng: SeededRng,
  turn: number,
  latentUsers: readonly User[],
  visibleUsers: readonly User[],
  islands: readonly Island[],
  cohorts: readonly CohortAnchor[],
  _hiddenTasteCohorts: readonly HiddenTasteCohort[] = [],
  epochState: EvidenceEpochState,
  participatingUsersPerTurn: number,
  maxRatingsPerUser: number
): RatingEvent[] {
  if (latentUsers.length === 0 || islands.length === 0 || participatingUsersPerTurn <= 0 || maxRatingsPerUser <= 0) {
    return [];
  }

  const visibleById = new Map(visibleUsers.map((user) => [user.id, user]));
  const candidateUsers = latentUsers.filter((user) => {
    const visible = visibleById.get(user.id);
    if (!visible) {
      return false;
    }

    return islands.some((island) => (visible.ratings[island.id] ?? null) === null);
  });

  const selectedUsers = rng.shuffle(candidateUsers).slice(0, Math.min(participatingUsersPerTurn, candidateUsers.length));
  const events: RatingEvent[] = [];

  for (const user of selectedUsers) {
    const visible = visibleById.get(user.id);
    if (!visible) {
      continue;
    }

    const unratedIslandIds = islands
      .map((island) => island.id)
      .filter((islandId) => (visible.ratings[islandId] ?? null) === null);

    if (unratedIslandIds.length === 0) {
      continue;
    }

    const ratingsToCreate = Math.min(
      unratedIslandIds.length,
      Math.max(1, rng.range(1, Math.max(1, maxRatingsPerUser)))
    );
    const pickedIslandIds = rng.shuffle(unratedIslandIds).slice(0, ratingsToCreate);

    for (const islandId of pickedIslandIds) {
      const rating = user.ratings[islandId] ?? 0;

      events.push({
        id: eventId(turn, user.id, islandId),
        turn,
        userId: user.id,
        islandId,
        rating,
        source: 'organic',
        raterSignalWeights: buildBootstrapSignalWeightSnapshot(cohorts),
        epoch: getCurrentEpochForIsland(epochState, islandId),
        islandVersionId: `island:${islandId}:v0`,
        gameRulesVersionId: 'game-rules-v0'
      });
    }
  }

  return events;
}

function summarizeTurn(
  turn: number,
  newEvents: readonly RatingEvent[],
  inferenceByUserId: ReadonlyMap<UserId, ReturnType<typeof computeInference>>,
  mode: 'organic' | 'guided' | 'mixed' = 'organic',
  participatingUserIds: UserId[] = Array.from(new Set(newEvents.map((event) => event.userId))).sort(),
  routedIslandIds: IslandId[] = [],
  recommendationKinds: Record<RecommendationKind, number> = buildRecommendationCounts(),
  organicRatingsCreated = newEvents.length,
  guidedRatingsCreated = 0,
  refreshCounts: { total: number; gamePatch: number; islandUpdate: number } = { total: 0, gamePatch: 0, islandUpdate: 0 }
): SimulationTurnSummary {
  const newlyRatedIslandIds = Array.from(new Set(newEvents.map((event) => event.islandId))).sort();

  return {
    turn,
    mode,
    participatingUserIds: participatingUserIds.slice().sort(),
    ratingsCreated: newEvents.length,
    organicRatingsCreated,
    guidedRatingsCreated,
    refreshEventsCreated: refreshCounts.total,
    gamePatchRefreshEventsCreated: refreshCounts.gamePatch,
    islandUpdateRefreshEventsCreated: refreshCounts.islandUpdate,
    newlyRatedIslandIds,
    routedIslandIds: routedIslandIds.slice().sort(),
    recommendationKinds: normalizeRecommendationCounts(recommendationKinds),
    diagnosisCounts: countDiagnoses(inferenceByUserId)
  };
}

function recomputeState(
  seed: number,
  latentUsers: readonly User[],
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  hiddenTasteCohorts: readonly HiddenTasteCohort[] = [],
  ratingEvents: readonly RatingEvent[],
  inferredRatingEvidence: readonly InferredRatingEvidenceRecord[] = [],
  turnHistory: readonly SimulationTurnSummary[],
  allTags: readonly TagId[],
  refreshEvents: readonly RatingRefreshEvent[] = [],
  observedBehaviorEvents?: readonly ObservedBehaviorEvent[],
  islandCohortRatingSnapshots?: readonly IslandCohortRatingState[],
  confidenceSnapshots?: readonly IslandCohortConfidenceSnapshot[]
): SimulationState {
  const normalizedRatingEvents = normalizeRatingEventEpochs(ratingEvents);
  const normalizedInferredRatingEvidence = inferredRatingEvidence.map((entry) => ({ ...entry }));
  const epochState = buildEvidenceEpochState(islands, refreshEvents);
  const activeRatingEvents = Array.from(latestActiveRatingsByPair(normalizedRatingEvents, epochState).values());
  const users = deriveVisibleUsersFromEvents(latentUsers, islands, normalizedRatingEvents);
  const inferenceByUserId = computeInferenceMap(
    users,
    cohorts,
    islands,
    allTags
  );
  const raterSignalAnalysis = buildRaterSignalProfiles(users, inferenceByUserId, cohorts);
  const normalizedObservedBehaviorEvents =
    observedBehaviorEvents ?? buildObservedBehaviorEvents(normalizedRatingEvents, latentUsers, seed);
  const derivedIslandCohortRatingSnapshots =
    islandCohortRatingSnapshots ??
    buildIslandCohortRatingSnapshots({
      islands,
      cohorts,
      ratingEvents: normalizedRatingEvents,
      turnHistory,
      refreshEvents,
      observedBehaviorEvents: normalizedObservedBehaviorEvents,
      signalProfiles: raterSignalAnalysis.byUserId
    });
  const islandAffinityAnalysis = buildIslandAffinityReports(
    activeRatingEvents,
    raterSignalAnalysis.byUserId,
    cohorts,
    islands,
    {
      ratingSnapshots: derivedIslandCohortRatingSnapshots,
      turnHistory,
      refreshEvents,
      observedBehaviorEvents: normalizedObservedBehaviorEvents
    }
  );
  const pseudoCohortAnalysis = analyzePseudoCohorts(users, inferenceByUserId);
  const reviewerArchetypeAnalysis = analyzeReviewerArchetypes(
    users,
    inferenceByUserId,
    raterSignalAnalysis.byUserId,
    cohorts,
    islands,
    activeRatingEvents
  );

  return {
    seed,
    currentTurn: turnHistory.length ? turnHistory[turnHistory.length - 1].turn : 0,
    allTags: allTags.slice(),
    latentUsers: latentUsers.map((user) => ({
      ...user,
      declaredTags: user.declaredTags.slice(),
      ratings: { ...user.ratings },
      hiddenTastePreferenceVector: user.hiddenTastePreferenceVector ? { ...user.hiddenTastePreferenceVector } : undefined
    })),
    users,
    cohorts: cohorts.map((cohort) => ({
      ...cohort,
      tags: cohort.tags.slice(),
      ratings: { ...cohort.ratings }
    })),
    islands: islands.map((island) => cloneIsland(island)),
    hiddenTasteCohorts: hiddenTasteCohorts.map((cohort) => cloneHiddenTasteCohort(cohort)),
    ratingEvents: normalizedRatingEvents.map((event) => ({ ...event })),
    refreshEvents: refreshEvents.map((event) => ({ ...event })),
    currentWorldEpoch: epochState.currentWorldEpoch,
    islandEpochById: { ...epochState.islandEpochById },
    observedBehaviorEvents: normalizedObservedBehaviorEvents.map((event) => cloneObservedBehaviorEvent(event)),
    islandCohortRatingSnapshots: derivedIslandCohortRatingSnapshots.map((snapshot) => cloneIslandCohortRatingSnapshot(snapshot)),
    inferenceByUserId,
    raterSignalProfiles: raterSignalAnalysis.byUserId,
    islandAffinityReports: islandAffinityAnalysis.byIslandId,
    pseudoCohortAnalysis,
    reviewerArchetypeAnalysis,
    turnHistory: turnHistory.map((summary) => ({
      ...summary,
      participatingUserIds: summary.participatingUserIds.slice(),
      newlyRatedIslandIds: summary.newlyRatedIslandIds.slice()
    })),
    confidenceSnapshots: confidenceSnapshots
      ? confidenceSnapshots.map((snapshot) => cloneConfidenceSnapshot(snapshot))
      : buildConfidenceSnapshots(latentUsers, cohorts, islands, normalizedRatingEvents, turnHistory, allTags, refreshEvents),
    inferredRatingEvidence: normalizedInferredRatingEvidence
  };
}

export function recomputeSimulationStateFromCanonicalEvents(
  snapshot: Pick<
    SerializedSimulationState,
    'seed' | 'allTags' | 'latentUsers' | 'cohorts' | 'islands' | 'ratingEvents' | 'turnHistory'
  > & {
    hiddenTasteCohorts?: readonly HiddenTasteCohort[];
    inferredRatingEvidence?: readonly InferredRatingEvidenceRecord[];
    refreshEvents?: readonly RatingRefreshEvent[];
    observedBehaviorEvents?: readonly ObservedBehaviorEvent[];
  }
): SimulationState {
  return recomputeState(
    snapshot.seed,
    snapshot.latentUsers,
    snapshot.cohorts,
    snapshot.islands,
    snapshot.hiddenTasteCohorts ?? deriveHiddenTasteCohortsFromUsers(snapshot.latentUsers, snapshot.cohorts),
    snapshot.ratingEvents,
    snapshot.inferredRatingEvidence ?? [],
    snapshot.turnHistory,
    snapshot.allTags,
    snapshot.refreshEvents ?? [],
    snapshot.observedBehaviorEvents
  );
}

function hydrateSimulationStateFromStoredSnapshots(snapshot: SerializedSimulationState): SimulationState {
  const normalizedObservedBehaviorEvents = snapshot.observedBehaviorEvents?.map((entry) => ({ ...entry }));
  const normalizedInferredRatingEvidence = snapshot.inferredRatingEvidence?.map((entry) => ({ ...entry })) ?? [];
  const normalizedIslandCohortRatingSnapshots = snapshot.islandCohortRatingSnapshots?.map((entry) => cloneIslandCohortRatingSnapshot(entry));
  const normalizedSnapshots = snapshot.confidenceSnapshots?.map((entry) => ({ ...entry }));
  const normalizedHiddenTasteCohorts = snapshot.hiddenTasteCohorts?.map((entry) => cloneHiddenTasteCohort(entry));
  const normalizedRefreshEvents = snapshot.refreshEvents?.map((entry) => ({ ...entry })) ?? [];
  const shouldReuseStoredSnapshots = normalizedRefreshEvents.length === 0;

  const state = recomputeState(
    snapshot.seed,
    snapshot.latentUsers,
    snapshot.cohorts,
    snapshot.islands,
    normalizedHiddenTasteCohorts ?? deriveHiddenTasteCohortsFromUsers(snapshot.latentUsers, snapshot.cohorts),
    snapshot.ratingEvents,
    normalizedInferredRatingEvidence,
    snapshot.turnHistory,
    snapshot.allTags,
    normalizedRefreshEvents,
    normalizedObservedBehaviorEvents,
    shouldReuseStoredSnapshots ? normalizedIslandCohortRatingSnapshots : undefined,
    shouldReuseStoredSnapshots ? normalizedSnapshots : undefined
  );
  return state;
}

export function serializeSimulationState(state: SimulationState): SerializedSimulationState {
  return {
    seed: state.seed,
    currentTurn: state.currentTurn,
    allTags: state.allTags.slice(),
    latentUsers: state.latentUsers.map((user) => ({
      ...user,
      declaredTags: user.declaredTags.slice(),
      ratings: { ...user.ratings },
      hiddenTastePreferenceVector: user.hiddenTastePreferenceVector ? { ...user.hiddenTastePreferenceVector } : undefined
    })),
    cohorts: state.cohorts.map((cohort) => ({
      ...cohort,
      tags: cohort.tags.slice(),
      ratings: { ...cohort.ratings }
    })),
    islands: state.islands.map((island) => cloneIsland(island)),
    hiddenTasteCohorts: state.hiddenTasteCohorts.map((cohort) => cloneHiddenTasteCohort(cohort)),
    ratingEvents: state.ratingEvents.map((event) => ({
      ...event,
      epoch: event.epoch ? { ...event.epoch } : undefined,
      raterSignalWeights: { ...event.raterSignalWeights }
    })),
    inferredRatingEvidence: state.inferredRatingEvidence.map((entry) => ({
      ...entry,
      epoch: entry.epoch ? { ...entry.epoch } : undefined
    })),
    refreshEvents: state.refreshEvents.map((event) => ({ ...event })),
    currentWorldEpoch: state.currentWorldEpoch,
    islandEpochById: { ...state.islandEpochById },
    observedBehaviorEvents: state.observedBehaviorEvents.map((event) => ({ ...event })),
    islandCohortRatingSnapshots: state.islandCohortRatingSnapshots.map((snapshot) => cloneIslandCohortRatingSnapshot(snapshot)),
    confidenceSnapshots: state.confidenceSnapshots.map((snapshot) => ({ ...snapshot })),
    turnHistory: state.turnHistory.map((summary) => ({
      ...summary,
      participatingUserIds: summary.participatingUserIds.slice(),
      newlyRatedIslandIds: summary.newlyRatedIslandIds.slice(),
      routedIslandIds: summary.routedIslandIds.slice(),
      recommendationKinds: normalizeRecommendationCounts(summary.recommendationKinds),
      diagnosisCounts: { ...summary.diagnosisCounts }
    }))
  };
}

export function hydrateSimulationState(snapshot: SerializedSimulationState): SimulationState {
  return hydrateSimulationStateFromStoredSnapshots(snapshot);
}

export function appendRefreshEvent(state: SimulationState, refreshEvent: RatingRefreshEvent): SimulationState {
  return recomputeState(
    state.seed,
    state.latentUsers,
    state.cohorts,
    state.islands,
    state.hiddenTasteCohorts,
    state.ratingEvents,
    state.inferredRatingEvidence,
    state.turnHistory,
    state.allTags,
    state.refreshEvents.concat(refreshEvent),
    state.observedBehaviorEvents
  );
}

export function createInitialSimulationState(config: SimulationBootstrapConfig): SimulationState {
  const rng = createSeededRandom(config.seed);
  const hiddenTasteCohorts =
    config.hiddenTasteCohorts?.map((cohort) => cloneHiddenTasteCohort(cohort)) ??
    deriveHiddenTasteCohortsFromUsers(config.latentUsers, config.cohorts);
  const initialEpochState = createInitialEvidenceEpoch(config.islands);
  const initialEvents = createRatingEventsForUsers(
    rng,
    0,
    config.latentUsers,
    deriveVisibleUsersFromEvents(config.latentUsers, config.islands, []),
    config.islands,
    config.cohorts,
    hiddenTasteCohorts,
    initialEpochState,
    config.latentUsers.length,
    config.initialRatingsPerUser
  );
  const initialState = recomputeState(
    config.seed,
    config.latentUsers,
    config.cohorts,
    config.islands,
    hiddenTasteCohorts,
    initialEvents,
    [],
    [],
    config.allTags,
    [],
    []
  );
  const initialSummary = summarizeTurn(0, initialEvents, initialState.inferenceByUserId);

  return recomputeState(
    config.seed,
    initialState.latentUsers,
    initialState.cohorts,
    initialState.islands,
    hiddenTasteCohorts,
    initialState.ratingEvents,
    initialState.inferredRatingEvidence,
    [initialSummary],
    config.allTags,
    [],
    []
  );
}

function hasUnratedIsland(user: User, islands: readonly Island[]): boolean {
  return islands.some((island) => (user.ratings[island.id] ?? null) === null);
}

function buildRoutingOptions(
  explorationWeight: number,
  highConfidenceBadFitThreshold: number,
  routeCount: number
): RecommendationOptions {
  return {
    explorationWeight,
    highConfidenceBadFitThreshold,
    topLimit: Math.max(8, routeCount * 2)
  };
}

function combineUniqueUsers(...groups: readonly (readonly User[])[]): User[] {
  const usersById = new Map<UserId, User>();

  for (const group of groups) {
    for (const user of group) {
      if (!usersById.has(user.id)) {
        usersById.set(user.id, user);
      }
    }
  }

  return Array.from(usersById.values());
}

function createOrganicEventsForUsers(
  rng: SeededRng,
  turn: number,
  visibleUsers: readonly User[],
  islands: readonly Island[],
  cohorts: readonly CohortAnchor[],
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  selectedUsers: readonly User[],
  historicalEvents: readonly RatingEvent[],
  currentVersions: { gameRulesVersionId: string; islandVersionById: Record<IslandId, string> },
  epochState: EvidenceEpochState,
  ratingCountModel: RatingCountModel,
  fixedRatingsPerUser: number,
  diceExpression: SupportedDiceExpression,
  usedPairs?: Set<string>
): RatingEvent[] {
  const visibleById = new Map(visibleUsers.map((user) => [user.id, user]));
  const events: RatingEvent[] = [];

  for (const user of selectedUsers) {
    const visible = visibleById.get(user.id);
    if (!visible) {
      continue;
    }

    const unratedIslandIds = islands
      .map((island) => island.id)
      .filter((islandId) => (visible.ratings[islandId] ?? null) === null && !(usedPairs?.has(eventId(turn, user.id, islandId)) ?? false));

    if (unratedIslandIds.length === 0) {
      continue;
    }

    const ratingsToCreate = Math.min(
      unratedIslandIds.length,
      resolveRatingCount(rng, ratingCountModel, fixedRatingsPerUser, diceExpression)
    );
    const pickedIslandIds = rng.shuffle(unratedIslandIds).slice(0, ratingsToCreate);

    for (const islandId of pickedIslandIds) {
      const rating = user.ratings[islandId] ?? 0;
      const key = eventId(turn, user.id, islandId);
      usedPairs?.add(key);
      const profile = signalProfiles.get(user.id);
      const previousEvent = latestHistoricalRatingEvent(historicalEvents, user.id, islandId);
      const weights = profile
        ? buildSignalWeightSnapshot(cohorts, new Map(cohorts.map((cohort) => [cohort.id, profile.cohortWeights[cohort.id] ?? 0])), 0)
        : buildSignalWeightSnapshot(cohorts, new Map(), 0);

      const candidateEvent = {
        id: key,
        turn,
        userId: user.id,
        islandId,
        rating,
        source: 'organic' as const,
        raterSignalWeights: weights,
        epoch: getCurrentEpochForIsland(epochState, islandId),
        islandVersionId: currentVersions.islandVersionById[islandId],
        gameRulesVersionId: currentVersions.gameRulesVersionId
      };
      const revisionReason = resolveRevisionReason(previousEvent, candidateEvent);
      events.push({
        ...candidateEvent,
        ...(revisionReason
          ? {
              revisionReason,
              supersedesEventId: previousEvent?.id
            }
          : {})
      });
    }
  }

  return events;
}

function createGuidedRatingEventsForUsers(
  rng: SeededRng,
  turn: number,
  visibleUsers: readonly User[],
  islands: readonly Island[],
  cohorts: readonly CohortAnchor[],
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  selectedUsers: readonly User[],
  historicalEvents: readonly RatingEvent[],
  currentVersions: { gameRulesVersionId: string; islandVersionById: Record<IslandId, string> },
  epochState: EvidenceEpochState,
  ratingCountModel: RatingCountModel,
  fixedRecommendationsPerUser: number,
  diceExpression: SupportedDiceExpression,
  recommendationOptions: RecommendationOptions,
  usedPairs?: Set<string>
): { events: RatingEvent[]; routedIslandIds: IslandId[]; recommendationKinds: Record<RecommendationKind, number> } {
  const visibleById = new Map(visibleUsers.map((user) => [user.id, user]));
  const events: RatingEvent[] = [];
  const routedIslandIds: IslandId[] = [];
  const recommendationKinds = buildRecommendationCounts();

  for (const user of selectedUsers) {
    const visible = visibleById.get(user.id);
    if (!visible) {
      continue;
    }

    const recommendations = recommendIslandsForUser(
      visible,
      islandAffinityReports,
      signalProfiles,
      islands,
      recommendationOptions
    ).recommendations.filter((entry) => (visible.ratings[entry.islandId] ?? null) === null && !(usedPairs?.has(eventId(turn, user.id, entry.islandId)) ?? false));

    if (recommendations.length === 0) {
      continue;
    }

    const recommendationsToCreate = Math.min(recommendations.length, resolveRatingCount(rng, ratingCountModel, fixedRecommendationsPerUser, diceExpression));
    const selectedRecommendations = recommendations.slice(0, recommendationsToCreate);

    for (const recommendation of selectedRecommendations) {
      const rating = user.ratings[recommendation.islandId] ?? 0;
      const key = eventId(turn, user.id, recommendation.islandId);
      usedPairs?.add(key);
      const profile = signalProfiles.get(user.id);
      const previousEvent = latestHistoricalRatingEvent(historicalEvents, user.id, recommendation.islandId);
      const weights = profile
        ? buildSignalWeightSnapshot(cohorts, new Map(cohorts.map((cohort) => [cohort.id, profile.cohortWeights[cohort.id] ?? 0])), 0)
        : buildSignalWeightSnapshot(cohorts, new Map(), 0);

      const candidateEvent = {
        id: key,
        turn,
        userId: user.id,
        islandId: recommendation.islandId,
        rating,
        source: 'guided' as const,
        raterSignalWeights: weights,
        epoch: getCurrentEpochForIsland(epochState, recommendation.islandId),
        islandVersionId: currentVersions.islandVersionById[recommendation.islandId],
        gameRulesVersionId: currentVersions.gameRulesVersionId
      };

      const revisionReason = resolveRevisionReason(previousEvent, candidateEvent);
      events.push({
        ...candidateEvent,
        ...(revisionReason
          ? {
              revisionReason,
              supersedesEventId: previousEvent?.id
            }
          : {})
      });
      routedIslandIds.push(recommendation.islandId);
      recommendationKinds[recommendation.recommendationKind] += 1;
    }
  }

  return {
    events,
    routedIslandIds,
    recommendationKinds
  };
}

export function advancePolicyTurn(
  state: SimulationState,
  config: AdvancePolicyTurnConfig
): SimulationState {
  const turn = state.currentTurn + 1;
  const rng = createSeededRandom(state.seed ^ (turn * 2654435761));
  const heartbeat = normalizeHeartbeatPolicy(config.heartbeat);
  const heartbeatRefreshEvents = buildHeartbeatRefreshEvents(state, turn, heartbeat);
  const nextRefreshEvents = state.refreshEvents.concat(heartbeatRefreshEvents);
  const currentVersions = buildCurrentRatingVersions(state.islands, nextRefreshEvents);
  const epochState = buildEvidenceEpochState(state.islands, nextRefreshEvents);
  const visibleUsers = deriveCurrentContextVisibleUsers(state.latentUsers, state.islands, state.ratingEvents, epochState);
  const visibleById = new Map(visibleUsers.map((user) => [user.id, user]));
  const organicCandidates = state.latentUsers.filter((user) => {
    const visible = visibleById.get(user.id);
    return visible ? hasUnratedIsland(visible, state.islands) : false;
  });

  const routingValues = resolveRoutingRiskProfileValues(config.routingRiskProfile, {
    explorationWeight: config.customExplorationWeight,
    badFitGuardThreshold: config.customBadFitGuardThreshold
  });
  const recommendationOptions = buildRoutingOptions(
    routingValues.explorationWeight,
    routingValues.badFitGuardThreshold,
    config.guidedRecommendationsPerUser
  );

  const guidedCandidates = organicCandidates.filter((user) => {
    const visible = visibleById.get(user.id);
    if (!visible) {
      return false;
    }

    return recommendIslandsForUser(visible, state.islandAffinityReports, state.raterSignalProfiles, state.islands, recommendationOptions).recommendations.length > 0;
  });

  const selectedOrganicUsers =
    config.turnMode === 'organic'
      ? selectParticipatingUsers(
          rng,
          organicCandidates,
          config.participationModel,
          config.participatingUsersPerTurn,
          config.participationChance
        )
      : config.turnMode === 'guided'
        ? []
        : selectParticipatingUsers(
            rng,
            organicCandidates,
            config.participationModel,
            config.participatingUsersPerTurn,
            config.participationChance
          );
  const selectedGuidedUsers =
    config.turnMode === 'organic'
      ? []
      : selectParticipatingUsers(
          rng,
          guidedCandidates,
          config.participationModel,
          config.participatingUsersPerTurn,
          config.participationChance
        );
  const usedPairs = new Set<string>();
  const organicEvents =
    config.turnMode === 'guided'
      ? []
      : createOrganicEventsForUsers(
          rng,
          turn,
          visibleUsers,
          state.islands,
          state.cohorts,
          state.raterSignalProfiles,
          selectedOrganicUsers,
          state.ratingEvents,
          currentVersions,
          epochState,
          config.organicRatingCountModel,
          config.organicRatingsPerUser,
          config.organicRatingDice,
          usedPairs
        );
  const guided =
    config.turnMode === 'organic'
      ? { events: [], routedIslandIds: [], recommendationKinds: buildRecommendationCounts() }
      : createGuidedRatingEventsForUsers(
          rng,
          turn,
          visibleUsers,
          state.islands,
          state.cohorts,
          state.raterSignalProfiles,
          state.islandAffinityReports,
          selectedGuidedUsers,
          state.ratingEvents,
          currentVersions,
          epochState,
          config.guidedRatingCountModel,
          config.guidedRecommendationsPerUser,
          config.guidedRecommendationDice,
          recommendationOptions,
          usedPairs
        );
  const newEvents = organicEvents.concat(guided.events);
  const nextEvents = state.ratingEvents.concat(newEvents);
  const activeNextEvents = Array.from(latestActiveRatingsByPair(nextEvents, epochState).values());
  const turnObservedBehaviorEvents = buildObservedBehaviorEvents(newEvents, state.latentUsers, state.seed);
  const nextObservedBehaviorEvents = state.observedBehaviorEvents.concat(
    turnObservedBehaviorEvents
  );
  const nextUsers = deriveVisibleUsersFromEvents(state.latentUsers, state.islands, nextEvents);
  const nextHistory = state.turnHistory.slice();
  const participatingUserIds = Array.from(new Set(combineUniqueUsers(selectedOrganicUsers, selectedGuidedUsers).map((user) => user.id))).sort();
  const nextVisibleUsers = nextUsers;
  const nextInferenceByUserId = computeInferenceMap(nextVisibleUsers, state.cohorts, state.islands, state.allTags);
  const nextRaterSignalAnalysis = buildRaterSignalProfiles(nextVisibleUsers, nextInferenceByUserId, state.cohorts);
  const nextTurnIslandCohortRatingSnapshots = buildIslandCohortRatingSnapshotsForTurn({
    islands: state.islands,
    cohorts: state.cohorts,
    turn,
    ratingEvents: newEvents,
    previousSnapshots: state.islandCohortRatingSnapshots,
    observedBehaviorEvents: turnObservedBehaviorEvents,
    signalProfiles: nextRaterSignalAnalysis.byUserId,
    refreshEvents: heartbeatRefreshEvents
  });
  const nextIslandCohortRatingSnapshots = state.islandCohortRatingSnapshots.concat(nextTurnIslandCohortRatingSnapshots);
  nextHistory.push(
    summarizeTurn(
      turn,
      newEvents,
      nextInferenceByUserId,
      config.turnMode,
      participatingUserIds,
      guided.routedIslandIds,
      guided.recommendationKinds,
      organicEvents.length,
      guided.events.length,
      countHeartbeatRefreshEvents(heartbeatRefreshEvents)
    )
  );

  const nextIslandAffinityAnalysis = buildIslandAffinityReports(
    activeNextEvents,
    nextRaterSignalAnalysis.byUserId,
    state.cohorts,
    state.islands,
    {
      ratingSnapshots: nextIslandCohortRatingSnapshots,
      turnHistory: nextHistory,
      refreshEvents: nextRefreshEvents,
      observedBehaviorEvents: nextObservedBehaviorEvents
    }
  );
  const nextPseudoCohortAnalysis = analyzePseudoCohorts(nextVisibleUsers, nextInferenceByUserId);
  const nextReviewerArchetypeAnalysis = analyzeReviewerArchetypes(
    nextVisibleUsers,
    nextInferenceByUserId,
    nextRaterSignalAnalysis.byUserId,
    state.cohorts,
    state.islands,
    activeNextEvents
  );

  return {
    seed: state.seed,
    currentTurn: turn,
    allTags: state.allTags.slice(),
    latentUsers: cloneUsers(state.latentUsers),
    users: nextVisibleUsers,
    cohorts: state.cohorts.map((cohort) => ({
      ...cohort,
      tags: cohort.tags.slice(),
      ratings: { ...cohort.ratings }
    })),
    islands: state.islands.map((island) => cloneIsland(island)),
    hiddenTasteCohorts: state.hiddenTasteCohorts.map((cohort) => cloneHiddenTasteCohort(cohort)),
    ratingEvents: nextEvents.map((event) => ({ ...event })),
    inferredRatingEvidence: state.inferredRatingEvidence.map((entry) => ({ ...entry })),
    refreshEvents: nextRefreshEvents.map((event) => ({ ...event })),
    currentWorldEpoch: epochState.currentWorldEpoch,
    islandEpochById: { ...epochState.islandEpochById },
    observedBehaviorEvents: nextObservedBehaviorEvents.map((event) => cloneObservedBehaviorEvent(event)),
    islandCohortRatingSnapshots: nextIslandCohortRatingSnapshots.map((snapshot) => cloneIslandCohortRatingSnapshot(snapshot)),
    confidenceSnapshots: state.confidenceSnapshots.concat(buildConfidenceSnapshotsForTurn(turn, nextIslandAffinityAnalysis.byIslandId)),
    inferenceByUserId: nextInferenceByUserId,
    raterSignalProfiles: nextRaterSignalAnalysis.byUserId,
    islandAffinityReports: nextIslandAffinityAnalysis.byIslandId,
    pseudoCohortAnalysis: nextPseudoCohortAnalysis,
    reviewerArchetypeAnalysis: nextReviewerArchetypeAnalysis,
    turnHistory: nextHistory.map((summary) => ({
      ...summary,
      participatingUserIds: summary.participatingUserIds.slice(),
      newlyRatedIslandIds: summary.newlyRatedIslandIds.slice(),
      routedIslandIds: summary.routedIslandIds.slice(),
      recommendationKinds: normalizeRecommendationCounts(summary.recommendationKinds),
      diagnosisCounts: { ...summary.diagnosisCounts }
    }))
  };
}

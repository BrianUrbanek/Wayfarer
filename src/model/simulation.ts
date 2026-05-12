import { analyzePseudoCohorts, type PseudoCohortAnalysis } from './pseudoCohorts.js';
import { analyzeReviewerArchetypes, type ReviewerArchetypeAnalysis } from './reviewerArchetypes.js';
import { computeInference } from './inference.js';
import { buildIslandAffinityReports, type IslandAffinityReport } from './affinity.js';
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
  type ParticipationModel,
  type RatingCountModel,
  type RoutingRiskProfile,
  type TurnMode
} from './turnPolicy.js';
import type { SupportedDiceExpression } from './dice.js';
import type {
  CohortAnchor,
  DiagnosisType,
  Island,
  IslandId,
  MaybeRating,
  Rating,
  TagId,
  User,
  UserId
} from './types.js';

export type RatingEventSource = 'organic' | 'guided';

export interface RatingEvent {
  readonly id: string;
  readonly turn: number;
  readonly userId: UserId;
  readonly islandId: IslandId;
  readonly rating: Rating;
  readonly source: RatingEventSource;
}

export interface SimulationTurnSummary {
  turn: number;
  mode: 'organic' | 'guided' | 'mixed';
  participatingUserIds: UserId[];
  ratingsCreated: number;
  organicRatingsCreated: number;
  guidedRatingsCreated: number;
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
  ratingEvents: RatingEvent[];
  inferenceByUserId: ReadonlyMap<UserId, ReturnType<typeof computeInference>>;
  raterSignalProfiles: ReadonlyMap<UserId, RaterSignalProfile>;
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>;
  pseudoCohortAnalysis: PseudoCohortAnalysis;
  reviewerArchetypeAnalysis: ReviewerArchetypeAnalysis;
  turnHistory: SimulationTurnSummary[];
}

export interface SimulationBootstrapConfig {
  seed: number;
  allTags: TagId[];
  latentUsers: User[];
  cohorts: CohortAnchor[];
  islands: Island[];
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
  customMinimumPredictedFit: number;
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

function eventKey(turn: number, userId: UserId, islandId: IslandId): string {
  return `${turn}:${userId}:${islandId}`;
}

function buildRecommendationCounts(): Record<RecommendationKind, number> {
  return {
    SAFE_FIT: 0,
    DISCOVERY_PROBE: 0
  };
}

export function deriveVisibleUsersFromEvents(
  latentUsers: readonly User[],
  islands: readonly Island[],
  events: readonly RatingEvent[]
): User[] {
  const ratingsByUserId = new Map<UserId, Record<IslandId, MaybeRating>>();

  for (const user of latentUsers) {
    ratingsByUserId.set(user.id, buildBlankRatings(islands));
  }

  for (const event of events) {
    const ratings = ratingsByUserId.get(event.userId);
    if (!ratings) {
      continue;
    }

    ratings[event.islandId] = event.rating;
  }

  return latentUsers.map((user) => cloneUserWithRatings(user, ratingsByUserId.get(user.id) ?? buildBlankRatings(islands)));
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
        id: eventKey(turn, user.id, islandId),
        turn,
        userId: user.id,
        islandId,
        rating,
        source: 'organic'
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
  routedIslandIds: IslandId[] = [],
  recommendationKinds: Record<RecommendationKind, number> = buildRecommendationCounts(),
  organicRatingsCreated = newEvents.length,
  guidedRatingsCreated = 0
): SimulationTurnSummary {
  const newlyRatedIslandIds = Array.from(new Set(newEvents.map((event) => event.islandId))).sort();

  return {
    turn,
    mode,
    participatingUserIds: Array.from(new Set(newEvents.map((event) => event.userId))).sort(),
    ratingsCreated: newEvents.length,
    organicRatingsCreated,
    guidedRatingsCreated,
    newlyRatedIslandIds,
    routedIslandIds: routedIslandIds.slice().sort(),
    recommendationKinds: { ...recommendationKinds },
    diagnosisCounts: countDiagnoses(inferenceByUserId)
  };
}

function recomputeState(
  seed: number,
  latentUsers: readonly User[],
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  ratingEvents: readonly RatingEvent[],
  turnHistory: readonly SimulationTurnSummary[],
  allTags: readonly TagId[]
): SimulationState {
  const users = deriveVisibleUsersFromEvents(latentUsers, islands, ratingEvents);
  const inferenceByUserId = computeInferenceMap(
    users,
    cohorts,
    islands,
    allTags
  );
  const raterSignalAnalysis = buildRaterSignalProfiles(users, inferenceByUserId, cohorts);
  const islandAffinityAnalysis = buildIslandAffinityReports(
    ratingEvents,
    raterSignalAnalysis.byUserId,
    cohorts,
    islands
  );
  const pseudoCohortAnalysis = analyzePseudoCohorts(users, inferenceByUserId);
  const reviewerArchetypeAnalysis = analyzeReviewerArchetypes(
    users,
    inferenceByUserId,
    raterSignalAnalysis.byUserId,
    cohorts,
    islands,
    ratingEvents
  );

  return {
    seed,
    currentTurn: turnHistory.length ? turnHistory[turnHistory.length - 1].turn : 0,
    allTags: allTags.slice(),
    latentUsers: latentUsers.map((user) => ({
      ...user,
      declaredTags: user.declaredTags.slice(),
      ratings: { ...user.ratings }
    })),
    users,
    cohorts: cohorts.map((cohort) => ({
      ...cohort,
      tags: cohort.tags.slice(),
      ratings: { ...cohort.ratings }
    })),
    islands: islands.map((island) => ({
      ...island,
      hiddenAppealPattern: island.hiddenAppealPattern ? { ...island.hiddenAppealPattern } : undefined
    })),
    ratingEvents: ratingEvents.map((event) => ({ ...event })),
    inferenceByUserId,
    raterSignalProfiles: raterSignalAnalysis.byUserId,
    islandAffinityReports: islandAffinityAnalysis.byIslandId,
    pseudoCohortAnalysis,
    reviewerArchetypeAnalysis,
    turnHistory: turnHistory.map((summary) => ({
      ...summary,
      participatingUserIds: summary.participatingUserIds.slice(),
      newlyRatedIslandIds: summary.newlyRatedIslandIds.slice()
    }))
  };
}

export function createInitialSimulationState(config: SimulationBootstrapConfig): SimulationState {
  const rng = createSeededRandom(config.seed);
  const initialEvents = createRatingEventsForUsers(
    rng,
    0,
    config.latentUsers,
    deriveVisibleUsersFromEvents(config.latentUsers, config.islands, []),
    config.islands,
    config.latentUsers.length,
    config.initialRatingsPerUser
  );
  const initialState = recomputeState(
    config.seed,
    config.latentUsers,
    config.cohorts,
    config.islands,
    initialEvents,
    [],
    config.allTags
  );
  const initialSummary = summarizeTurn(0, initialEvents, initialState.inferenceByUserId);

  return recomputeState(
    config.seed,
    initialState.latentUsers,
    initialState.cohorts,
    initialState.islands,
    initialState.ratingEvents,
    [initialSummary],
    config.allTags
  );
}

function hasUnratedIsland(user: User, islands: readonly Island[]): boolean {
  return islands.some((island) => (user.ratings[island.id] ?? null) === null);
}

function buildRoutingOptions(
  explorationWeight: number,
  minPredictedFitFloor: number,
  routeCount: number
): RecommendationOptions {
  return {
    explorationWeight,
    minPredictedFitFloor,
    topLimit: Math.max(8, routeCount * 2)
  };
}

function createOrganicEventsForUsers(
  rng: SeededRng,
  turn: number,
  visibleUsers: readonly User[],
  islands: readonly Island[],
  selectedUsers: readonly User[],
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
      .filter((islandId) => (visible.ratings[islandId] ?? null) === null && !(usedPairs?.has(eventKey(turn, user.id, islandId)) ?? false));

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
      const key = eventKey(turn, user.id, islandId);
      usedPairs?.add(key);

      events.push({
        id: key,
        turn,
        userId: user.id,
        islandId,
        rating,
        source: 'organic'
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
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  selectedUsers: readonly User[],
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
    ).recommendations.filter((entry) => (visible.ratings[entry.islandId] ?? null) === null && !(usedPairs?.has(eventKey(turn, user.id, entry.islandId)) ?? false));

    if (recommendations.length === 0) {
      continue;
    }

    const recommendationsToCreate = Math.min(recommendations.length, resolveRatingCount(rng, ratingCountModel, fixedRecommendationsPerUser, diceExpression));
    const selectedRecommendations = recommendations.slice(0, recommendationsToCreate);

    for (const recommendation of selectedRecommendations) {
      const rating = user.ratings[recommendation.islandId] ?? 0;
      const key = eventKey(turn, user.id, recommendation.islandId);
      usedPairs?.add(key);

      events.push({
        id: key,
        turn,
        userId: user.id,
        islandId: recommendation.islandId,
        rating,
        source: 'guided'
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
  const visibleUsers = state.users;
  const visibleById = new Map(visibleUsers.map((user) => [user.id, user]));
  const organicCandidates = state.latentUsers.filter((user) => {
    const visible = visibleById.get(user.id);
    return visible ? hasUnratedIsland(visible, state.islands) : false;
  });

  const routingValues = resolveRoutingRiskProfileValues(config.routingRiskProfile, {
    explorationWeight: config.customExplorationWeight,
    minimumPredictedFit: config.customMinimumPredictedFit
  });
  const recommendationOptions = buildRoutingOptions(
    routingValues.explorationWeight,
    routingValues.minimumPredictedFit,
    config.guidedRecommendationsPerUser
  );

  const guidedCandidates = organicCandidates.filter((user) => {
    const visible = visibleById.get(user.id);
    if (!visible) {
      return false;
    }

    return recommendIslandsForUser(visible, state.islandAffinityReports, state.raterSignalProfiles, state.islands, recommendationOptions).recommendations.length > 0;
  });

  const selectedOrganicUsers = config.turnMode === 'guided'
    ? []
    : selectParticipatingUsers(
        rng,
        organicCandidates,
        config.participationModel,
        config.participatingUsersPerTurn,
        config.participationChance
      );
  const selectedGuidedUsers = config.turnMode === 'organic'
    ? []
    : config.turnMode === 'mixed'
      ? selectParticipatingUsers(
          rng,
          guidedCandidates,
          config.participationModel,
          config.participatingUsersPerTurn,
          config.participationChance
        )
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
          selectedOrganicUsers,
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
          state.raterSignalProfiles,
          state.islandAffinityReports,
          selectedGuidedUsers,
          config.guidedRatingCountModel,
          config.guidedRecommendationsPerUser,
          config.guidedRecommendationDice,
          recommendationOptions,
          usedPairs
        );
  const newEvents = organicEvents.concat(guided.events);
  const nextEvents = state.ratingEvents.concat(newEvents);
  const nextHistory = state.turnHistory.slice();

  const nextVisibleUsers = deriveVisibleUsersFromEvents(state.latentUsers, state.islands, nextEvents);
  const nextInferenceByUserId = computeInferenceMap(nextVisibleUsers, state.cohorts, state.islands, state.allTags);
  nextHistory.push(
    summarizeTurn(
      turn,
      newEvents,
      nextInferenceByUserId,
      config.turnMode,
      guided.routedIslandIds,
      guided.recommendationKinds,
      organicEvents.length,
      guided.events.length
    )
  );

  return recomputeState(
    state.seed,
    state.latentUsers,
    state.cohorts,
    state.islands,
    nextEvents,
    nextHistory,
    state.allTags
  );
}

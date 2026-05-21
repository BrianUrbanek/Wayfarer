import { describe, expect, it } from 'vitest';
import { DEFAULT_TAGS } from '../data/defaultTags';
import { createDefaultCohorts } from '../data/defaultCohorts';
import { generateColumbusDataset } from '../generator/columbusGenerator';
import { computeInference } from '../model/inference';
import { recommendIslandsForUser } from '../model/recommendations';
import {
  advancePolicyTurn,
  createInitialSimulationState,
  deriveVisibleUsersFromEvents,
  type RatingEvent
} from '../model/simulation';

function buildBootstrap(seed = 24680) {
  const dataset = generateColumbusDataset({
    seed,
    numUsers: 6,
    numIslands: 8,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 10 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
  });

  return {
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    hiddenTasteCohorts: dataset.hiddenTasteCohorts
  };
}

function buildSingleUserBootstrap(seed = 13579) {
  const dataset = generateColumbusDataset({
    seed,
    numUsers: 1,
    numIslands: 6,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 10 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
  });

  return {
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    hiddenTasteCohorts: dataset.hiddenTasteCohorts
  };
}

function buildSignalWeights(bootstrap: ReturnType<typeof buildBootstrap>, defaultWeight = 1) {
  return Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, defaultWeight])) as Record<string, number>;
}

function visibleUserWithEvents(events: RatingEvent[], index = 0) {
  const bootstrap = buildBootstrap();
  const [user] = deriveVisibleUsersFromEvents([bootstrap.latentUsers[index]], bootstrap.islands, events);
  if (!user) {
    throw new Error('Expected a visible user');
  }

  return { bootstrap, user };
}

const ORGANIC_TURN_CONFIG = {
  turnMode: 'organic' as const,
  participationModel: 'fixed-count' as const,
  participatingUsersPerTurn: 2,
  participationChance: 0.5,
  organicRatingCountModel: 'fixed-count' as const,
  organicRatingsPerUser: 2,
  organicRatingDice: '1d2' as const,
  guidedRatingCountModel: 'fixed-count' as const,
  guidedRecommendationsPerUser: 0,
  guidedRecommendationDice: '1d2' as const,
  routingRiskProfile: 'custom' as const,
  customExplorationWeight: 0.55,
  customMinimumPredictedFit: -1
};

const GUIDED_TURN_CONFIG = {
  turnMode: 'guided' as const,
  participationModel: 'fixed-count' as const,
  participatingUsersPerTurn: 4,
  participationChance: 0.5,
  organicRatingCountModel: 'fixed-count' as const,
  organicRatingsPerUser: 0,
  organicRatingDice: '1d2' as const,
  guidedRatingCountModel: 'fixed-count' as const,
  guidedRecommendationsPerUser: 3,
  guidedRecommendationDice: '1d2' as const,
  routingRiskProfile: 'custom' as const,
  customExplorationWeight: 0.55,
  customMinimumPredictedFit: -1
};

describe('simulation layer', () => {
  it('starts sparse at turn 0 when no initial ratings are seeded', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });

    expect(state.currentTurn).toBe(0);
    expect(state.ratingEvents).toHaveLength(0);
    expect(state.users.every((user) => Object.values(user.ratings).every((rating) => rating === null))).toBe(true);
  });

  it('bootstraps turn 0 ratings with default signal weights', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
    const firstEvent = state.ratingEvents[0];

    expect(firstEvent).toBeTruthy();
    expect(firstEvent?.turn).toBe(0);
    expect(Object.values(firstEvent?.raterSignalWeights ?? {}).every((weight) => weight === 1)).toBe(true);
  });

  it('preserves the full generated hidden taste cohort set in initial simulation state', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });

    expect(state.hiddenTasteCohorts).toHaveLength(bootstrap.hiddenTasteCohorts.length);
    expect(state.hiddenTasteCohorts.map((cohort) => cohort.id)).toEqual(bootstrap.hiddenTasteCohorts.map((cohort) => cohort.id));
  });

  it('advances organic turns and only adds previously unrated pairs', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, ORGANIC_TURN_CONFIG);

    expect(next.currentTurn).toBe(1);
    expect(next.ratingEvents.length).toBeGreaterThan(state.ratingEvents.length);

    const previousPairs = new Set(state.ratingEvents.map((event) => `${event.userId}:${event.islandId}`));
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    for (const event of freshEvents) {
      expect(previousPairs.has(`${event.userId}:${event.islandId}`)).toBe(false);
      const before = state.users.find((user) => user.id === event.userId);
      const after = next.users.find((user) => user.id === event.userId);
      expect(before?.ratings[event.islandId] ?? null).toBe(null);
      expect(after?.ratings[event.islandId] ?? null).toBe(event.rating);
    }
  });

  it('keeps organic turn events marked as organic', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, ORGANIC_TURN_CONFIG);
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    expect(freshEvents.length).toBeGreaterThan(0);
    expect(freshEvents.every((event) => event.source === 'organic')).toBe(true);
  });

  it('preserves neutral 0 ratings separately from unrated nulls', () => {
    const bootstrap = buildBootstrap();
    const island = bootstrap.islands[0];
    const userId = bootstrap.latentUsers[0].id;
    const [visibleUser] = deriveVisibleUsersFromEvents(bootstrap.latentUsers, bootstrap.islands, [
      {
        id: 'turn-0:user-0:island-1',
        turn: 0,
        userId,
        islandId: island.id,
        rating: 0,
        source: 'organic',
        raterSignalWeights: buildSignalWeights(bootstrap)
      }
    ]);

    expect(visibleUser?.ratings[island.id]).toBe(0);
    expect(Object.values(visibleUser?.ratings ?? {}).filter((rating) => rating === null)).toHaveLength(
      bootstrap.islands.length - 1
    );
  });

  it('keeps sparse inference evidence lower than a dense neutral fill', () => {
    const bootstrap = buildBootstrap();
    const islandIds = bootstrap.islands.map((island) => island.id);
    const latentUser = bootstrap.latentUsers[0];

    const sparseVisibleUser = visibleUserWithEvents(
      [
        {
          id: 'turn-0:user-0:island-1',
          turn: 0,
          userId: latentUser.id,
          islandId: islandIds[0],
          rating: 0,
          source: 'organic',
          raterSignalWeights: buildSignalWeights(bootstrap)
        }
      ],
      0
    ).user;

    const denseVisibleUser = visibleUserWithEvents(
      islandIds.map((islandId, index) => ({
        id: `turn-0:user-0:island-${index + 1}`,
        turn: 0,
        userId: latentUser.id,
        islandId,
        rating: 0,
        source: 'organic' as const,
        raterSignalWeights: buildSignalWeights(bootstrap)
      }))
    ).user;

    const sparseInference = computeInference(sparseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);
    const denseInference = computeInference(denseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);

    expect(sparseInference.ratingEvidence).toBeLessThan(denseInference.ratingEvidence);
    expect(sparseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0).toBeLessThan(
      denseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0
    );
  });

  it('accumulates events across multiple organic turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const firstTurn = advancePolicyTurn(state, ORGANIC_TURN_CONFIG);
    const secondTurn = advancePolicyTurn(firstTurn, ORGANIC_TURN_CONFIG);

    expect(secondTurn.currentTurn).toBe(2);
    expect(secondTurn.ratingEvents.length).toBeGreaterThan(firstTurn.ratingEvents.length);
    expect(secondTurn.turnHistory).toHaveLength(3);
  });

  it('derives rater signal profiles and island affinity reports from sparse turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, ORGANIC_TURN_CONFIG);

    expect(next.raterSignalProfiles.size).toBe(next.users.length);
    expect(next.islandAffinityReports.size).toBe(next.islands.length);
  });

  it('lags affinity weighting behind same-turn signal updates', () => {
    const bootstrap = buildSingleUserBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const firstTurn = advancePolicyTurn(state, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 1,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 3,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });
    const firstEvent = firstTurn.ratingEvents.at(-1);

    expect(firstEvent).toBeTruthy();
    expect(firstTurn.raterSignalProfiles.get(firstEvent?.userId ?? '')?.overallSignal ?? 0).toBeGreaterThan(0);
    expect(firstEvent?.raterSignalWeights[bootstrap.cohorts[0].id]).toBe(0);

    const firstEstimate = firstEvent
      ? firstTurn.islandAffinityReports
          .get(firstEvent.islandId)
          ?.estimates.find((entry) => entry.cohortId === bootstrap.cohorts[0].id)
      : null;
    const firstContribution = firstEvent
      ? firstTurn.islandAffinityReports
          .get(firstEvent.islandId)
          ?.estimates.find((entry) => entry.cohortId === bootstrap.cohorts[0].id)
          ?.contributions.find((entry) => entry.userId === firstEvent.userId)
      : null;

    expect(firstContribution).toBeUndefined();
    expect(firstEstimate?.effectiveWeight ?? 1).toBe(0);

    const secondTurn = advancePolicyTurn(firstTurn, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 1,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 1,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });
    const secondEvent = secondTurn.ratingEvents.at(-1);
    const firstProfile = firstTurn.raterSignalProfiles.get(firstEvent?.userId ?? '');
    const trackedCohortId =
      firstProfile?.topCohortId ??
      Object.entries(firstProfile?.cohortWeights ?? {}).find(([, weight]) => weight > 0)?.[0] ??
      null;

    expect(secondEvent).toBeTruthy();
    expect(secondTurn.raterSignalProfiles.get(secondEvent?.userId ?? '')?.overallSignal ?? 0).toBeGreaterThan(0);
    expect(trackedCohortId).toBeTruthy();
    expect(secondEvent?.raterSignalWeights[trackedCohortId ?? ''] ?? 0).toBe(firstProfile?.cohortWeights[trackedCohortId ?? ''] ?? 0);

    expect(secondTurn.islandAffinityReports.get(secondEvent?.islandId ?? '')).toBeTruthy();
  });

  it('routes guided turns from pre-turn recommendations and marks events as guided', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
    const preTurnRecommendations = new Map(
      state.users.map((user) => [
        user.id,
        recommendIslandsForUser(
          user,
          state.islandAffinityReports,
          state.raterSignalProfiles,
          state.islands,
          { explorationWeight: 0.55, minPredictedFitFloor: -1, topLimit: 8 }
        ).recommendations.map((recommendation) => recommendation.islandId)
      ])
    );
    const next = advancePolicyTurn(state, GUIDED_TURN_CONFIG);
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    expect(next.turnHistory.at(-1)?.mode).toBe('guided');
    expect(freshEvents.length).toBeGreaterThan(0);
    expect(freshEvents.every((event) => event.source === 'guided')).toBe(true);

    for (const event of freshEvents) {
      expect(state.users.find((user) => user.id === event.userId)?.ratings[event.islandId] ?? null).toBe(null);
      expect(preTurnRecommendations.get(event.userId) ?? []).toContain(event.islandId);
    }
  });

  it('runs mixed turns through both organic and guided pipelines', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
    const next = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 3,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 1,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 1,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 1,
      customMinimumPredictedFit: -1
    });

    expect(next.turnHistory.at(-1)?.mode).toBe('mixed');
    expect(next.turnHistory.at(-1)?.ratingsCreated ?? 0).toBeGreaterThan(0);
    expect(next.turnHistory.at(-1)?.organicRatingsCreated ?? 0).toBeGreaterThanOrEqual(0);
    expect(next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0).toBeGreaterThanOrEqual(0);
    expect(
      next.ratingEvents.slice(state.ratingEvents.length).every((event) => event.source === 'organic' || event.source === 'guided')
    ).toBe(true);
  });
});

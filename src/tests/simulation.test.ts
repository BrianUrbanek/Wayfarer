import { describe, expect, it } from 'vitest';
import { DEFAULT_TAGS } from '../data/defaultTags';
import { createDefaultCohorts } from '../data/defaultCohorts';
import { generateColumbusDataset } from '../generator/columbusGenerator';
import { computeInference } from '../model/inference';
import { recommendIslandsForUser } from '../model/recommendations';
import {
  advanceActiveTurn,
  advancePassiveTurn,
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
    islands: dataset.islands
  };
}

function visibleUserWithEvents(events: RatingEvent[], index = 0) {
  const bootstrap = buildBootstrap();
  const [user] = deriveVisibleUsersFromEvents([bootstrap.latentUsers[index]], bootstrap.islands, events);
  if (!user) {
    throw new Error('Expected a visible user');
  }

  return { bootstrap, user };
}

describe('simulation layer', () => {
  it('starts sparse at turn 0 when no initial ratings are seeded', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });

    expect(state.currentTurn).toBe(0);
    expect(state.ratingEvents).toHaveLength(0);
    expect(state.users.every((user) => Object.values(user.ratings).every((rating) => rating === null))).toBe(true);
  });

  it('advances turns and only adds previously unrated pairs', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePassiveTurn(state, { activeUsersPerTurn: 2, maxRatingsPerActiveUser: 2 });

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

  it('keeps passive turn events marked as passive', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePassiveTurn(state, { activeUsersPerTurn: 2, maxRatingsPerActiveUser: 2 });
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    expect(freshEvents.length).toBeGreaterThan(0);
    expect(freshEvents.every((event) => event.source === 'passive')).toBe(true);
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
        source: 'passive'
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
          source: 'passive'
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
        source: 'passive' as const
      }))
    ).user;

    const sparseInference = computeInference(sparseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);
    const denseInference = computeInference(denseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);

    expect(sparseInference.ratingEvidence).toBeLessThan(denseInference.ratingEvidence);
    expect(sparseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0).toBeLessThan(
      denseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0
    );
  });

  it('accumulates events across multiple passive turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const firstTurn = advancePassiveTurn(state, { activeUsersPerTurn: 2, maxRatingsPerActiveUser: 2 });
    const secondTurn = advancePassiveTurn(firstTurn, { activeUsersPerTurn: 2, maxRatingsPerActiveUser: 2 });

    expect(secondTurn.currentTurn).toBe(2);
    expect(secondTurn.ratingEvents.length).toBeGreaterThan(firstTurn.ratingEvents.length);
    expect(secondTurn.turnHistory).toHaveLength(3);
  });

  it('derives rater signal profiles and island affinity reports from sparse turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePassiveTurn(state, { activeUsersPerTurn: 2, maxRatingsPerActiveUser: 2 });

    expect(next.raterSignalProfiles.size).toBe(next.users.length);
    expect(next.islandAffinityReports.size).toBe(next.islands.length);
  });

  it('routes active turns from pre-turn recommendations and marks events as active', () => {
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
    const next = advanceActiveTurn(state, {
      activeUsersPerTurn: 4,
      routedIslandsPerActiveUser: 3,
      explorationWeight: 0.55,
      minPredictedFitFloor: -1
    });
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    expect(next.turnHistory.at(-1)?.mode).toBe('active');
    expect(freshEvents.length).toBeGreaterThan(0);
    expect(freshEvents.every((event) => event.source === 'active')).toBe(true);

    for (const event of freshEvents) {
      expect(state.users.find((user) => user.id === event.userId)?.ratings[event.islandId] ?? null).toBe(null);
      expect(preTurnRecommendations.get(event.userId) ?? []).toContain(event.islandId);
    }
  });
});

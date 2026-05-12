import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { computeInference } from '../../model/inference.js';
import { recommendIslandsForUser } from '../../model/recommendations.js';
import {
  advancePolicyTurn,
  createInitialSimulationState,
  deriveVisibleUsersFromEvents,
  type RatingEvent
} from '../../model/simulation.js';

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
  assert.ok(user);
  return { bootstrap, user };
}

describe('simulation layer', () => {
  it('starts sparse at turn 0 when no initial ratings are seeded', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });

    assert.equal(state.currentTurn, 0);
    assert.equal(state.ratingEvents.length, 0);
    assert.equal(
      state.users.every((user) => Object.values(user.ratings).every((rating) => rating === null)),
      true
    );
  });

  it('advances organic turns and only adds previously unrated pairs', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 2,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });

    assert.equal(next.currentTurn, 1);
    assert.ok(next.ratingEvents.length > state.ratingEvents.length);

    const previousPairs = new Set(state.ratingEvents.map((event) => `${event.userId}:${event.islandId}`));
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    for (const event of freshEvents) {
      assert.equal(previousPairs.has(`${event.userId}:${event.islandId}`), false);
      const before = state.users.find((user) => user.id === event.userId);
      const after = next.users.find((user) => user.id === event.userId);
      assert.equal(before?.ratings[event.islandId] ?? null, null);
      assert.equal(after?.ratings[event.islandId] ?? null, event.rating);
    }
  });

  it('keeps organic turn events marked as organic', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 2,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    assert.ok(freshEvents.length > 0);
    assert.equal(freshEvents.every((event) => event.source === 'organic'), true);
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
        source: 'organic'
      }
    ]);

    assert.equal(visibleUser?.ratings[island.id], 0);
    assert.equal(
      Object.values(visibleUser?.ratings ?? {}).filter((rating) => rating === null).length,
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
          source: 'organic'
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
        source: 'organic' as const
      }))
    ).user;

    const sparseInference = computeInference(sparseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);
    const denseInference = computeInference(denseVisibleUser, bootstrap.cohorts, bootstrap.allTags, bootstrap.islands);

    assert.ok(sparseInference.ratingEvidence < denseInference.ratingEvidence);
    assert.ok(
      (sparseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0) <
        (denseInference.behavioralSimilarities[0]?.similarity.overlapCount ?? 0)
    );
  });

  it('accumulates events across multiple organic turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const firstTurn = advancePolicyTurn(state, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 2,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });
    const secondTurn = advancePolicyTurn(firstTurn, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 2,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });

    assert.equal(secondTurn.currentTurn, 2);
    assert.ok(secondTurn.ratingEvents.length > firstTurn.ratingEvents.length);
    assert.equal(secondTurn.turnHistory.length, 3);
  });

  it('derives rater signal profiles and island affinity reports from sparse turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 2,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });

    assert.equal(next.raterSignalProfiles.size, next.users.length);
    assert.equal(next.islandAffinityReports.size, next.islands.length);
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
    const next = advancePolicyTurn(state, {
      turnMode: 'guided',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 4,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 0,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 3,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: -1
    });
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);

    assert.equal(next.turnHistory.at(-1)?.mode, 'guided');
    assert.ok(freshEvents.length > 0);
    assert.equal(freshEvents.every((event) => event.source === 'guided'), true);

    for (const event of freshEvents) {
      assert.equal(state.users.find((user) => user.id === event.userId)?.ratings[event.islandId] ?? null, null);
      assert.ok((preTurnRecommendations.get(event.userId) ?? []).includes(event.islandId));
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

    assert.equal(next.turnHistory.at(-1)?.mode, 'mixed');
    assert.ok((next.turnHistory.at(-1)?.organicRatingsCreated ?? 0) > 0);
    assert.ok((next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) > 0);
    assert.equal(
      next.ratingEvents.slice(state.ratingEvents.length).every((event) => event.source === 'organic' || event.source === 'guided'),
      true
    );
  });
});

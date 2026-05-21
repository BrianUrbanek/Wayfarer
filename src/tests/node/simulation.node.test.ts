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
  hydrateSimulationState,
  serializeSimulationState,
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
    islands: dataset.islands
  };
}

function buildSignalWeights(bootstrap: ReturnType<typeof buildBootstrap>, defaultWeight = 1) {
  return Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, defaultWeight])) as Record<string, number>;
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
    assert.equal(state.confidenceSnapshots.length, state.islands.length * state.cohorts.length);
    assert.equal(state.confidenceSnapshots.every((snapshot) => snapshot.turn === 0), true);
    assert.equal(
      state.users.every((user) => Object.values(user.ratings).every((rating) => rating === null)),
      true
    );
  });

  it('bootstraps turn 0 ratings with default signal weights', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
    const firstEvent = state.ratingEvents[0];

    assert.ok(firstEvent);
    assert.equal(firstEvent.turn, 0);
    assert.equal(
      Object.values(firstEvent.raterSignalWeights).every((weight) => weight === 1),
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

    const turnZeroSnapshots = next.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0);
    const turnOneSnapshots = next.confidenceSnapshots.filter((snapshot) => snapshot.turn === 1);

    assert.equal(turnZeroSnapshots.length, state.islands.length * state.cohorts.length);
    assert.equal(turnOneSnapshots.length, state.islands.length * state.cohorts.length);
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
        source: 'organic',
        raterSignalWeights: buildSignalWeights(bootstrap)
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
    assert.equal(secondTurn.confidenceSnapshots.filter((snapshot) => snapshot.turn === 2).length, bootstrap.islands.length * bootstrap.cohorts.length);
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

  it('round-trips confidence snapshots through serialization and hydrates legacy saves without them', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 2 });
    const serialized = serializeSimulationState(state);
    const restored = hydrateSimulationState(serialized);
    const legacyWithoutBehavior = {
      ...serialized,
      latentUsers: serialized.latentUsers.map((user) => ({
        ...user,
        hiddenBehaviorProfile: undefined
      })),
      observedBehaviorEvents: undefined
    };
    const legacyRestored = hydrateSimulationState({
      ...serialized,
      confidenceSnapshots: undefined
    });
    const fallbackRestored = hydrateSimulationState(legacyWithoutBehavior);

    assert.equal(serialized.confidenceSnapshots?.length, state.confidenceSnapshots.length);
    assert.equal(serialized.observedBehaviorEvents?.length, state.observedBehaviorEvents.length);
    assert.deepEqual(restored.confidenceSnapshots, state.confidenceSnapshots);
    assert.deepEqual(legacyRestored.confidenceSnapshots, state.confidenceSnapshots);
    assert.deepEqual(fallbackRestored.observedBehaviorEvents, state.observedBehaviorEvents);
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

    assert.ok(firstEvent);
    assert.ok((firstTurn.raterSignalProfiles.get(firstEvent.userId)?.overallSignal ?? 0) > 0);
    assert.equal(firstEvent.raterSignalWeights[bootstrap.cohorts[0].id], 0);

    const firstEstimate = firstTurn.islandAffinityReports
      .get(firstEvent.islandId)
      ?.estimates.find((entry) => entry.cohortId === bootstrap.cohorts[0].id);
    const firstContribution = firstEstimate?.contributions.find((entry) => entry.userId === firstEvent.userId);

    assert.equal(firstContribution, undefined);
    assert.equal(firstEstimate?.effectiveWeight ?? 1, 0);

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

    assert.ok(secondEvent);
    assert.ok((secondTurn.raterSignalProfiles.get(secondEvent.userId)?.overallSignal ?? 0) > 0);
    assert.ok(secondEvent.raterSignalWeights[bootstrap.cohorts[0].id] > 0);

    const secondEstimate = secondTurn.islandAffinityReports
      .get(secondEvent.islandId)
      ?.estimates.find((entry) => entry.cohortId === bootstrap.cohorts[0].id);
    const secondContribution = secondEstimate?.contributions.find((entry) => entry.userId === secondEvent.userId);

    assert.ok((secondContribution?.raterSignal ?? 0) > 0);
    assert.ok((secondContribution?.weightedContribution ?? 0) !== 0);
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
    assert.equal((next.turnHistory.at(-1)?.participatingUserIds.length ?? 0) <= 3, true);
    assert.ok((next.turnHistory.at(-1)?.ratingsCreated ?? 0) > 0);
    assert.ok((next.turnHistory.at(-1)?.organicRatingsCreated ?? 0) >= 0);
    assert.ok((next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) >= 0);
    assert.equal(
      next.ratingEvents.slice(state.ratingEvents.length).every((event) => event.source === 'organic' || event.source === 'guided'),
      true
    );
  });

  it('keeps mixed participation capped to the shared selected set', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 1,
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

    assert.equal((next.turnHistory.at(-1)?.participatingUserIds.length ?? 0) <= 1, true);
  });

  it('evaluates organic and guided streams against the same mixed participant set', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
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

    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);
    const participantIds = new Set(next.turnHistory.at(-1)?.participatingUserIds ?? []);

    assert.equal(participantIds.size <= 2, true);
    assert.equal(freshEvents.every((event) => participantIds.has(event.userId)), true);
  });

  it('can leave selected mixed participants without events when both streams are disabled', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 0,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 1,
      customMinimumPredictedFit: -1
    });

    assert.equal((next.turnHistory.at(-1)?.participatingUserIds.length ?? 0) <= 2, true);
    assert.equal(next.turnHistory.at(-1)?.organicRatingsCreated ?? 0, 0);
    assert.equal(next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0, 0);
  });

  it('can make selected mixed participants act in either single stream when the other stream is disabled', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });

    const organicOnly = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 6,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 1,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 0,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 1,
      customMinimumPredictedFit: -1
    });

    const guidedOnly = advancePolicyTurn(state, {
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 6,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 0,
      organicRatingDice: '1d2',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 1,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'custom',
      customExplorationWeight: 1,
      customMinimumPredictedFit: -1
    });

    assert.ok((organicOnly.turnHistory.at(-1)?.organicRatingsCreated ?? 0) > 0);
    assert.equal(organicOnly.turnHistory.at(-1)?.guidedRatingsCreated ?? 0, 0);
    assert.equal(guidedOnly.turnHistory.at(-1)?.organicRatingsCreated ?? 0, 0);
    assert.ok((guidedOnly.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) > 0);
  });
});

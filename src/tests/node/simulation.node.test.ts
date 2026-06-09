import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { computeInference } from '../../model/inference.js';
import { getScenarioPreset } from '../../model/scenarioPresets.js';
import { recommendIslandsForUser } from '../../model/recommendations.js';
import {
  DEFAULT_HEARTBEAT_POLICY,
  type HeartbeatPolicy,
} from '../../model/turnPolicy.js';
import {
  advancePolicyTurn,
  appendRefreshEvent,
  buildHeartbeatRefreshEvents,
  createInitialSimulationState,
  deriveVisibleUsersFromEvents,
  recomputeSimulationStateFromCanonicalEvents,
  hydrateSimulationState,
  serializeSimulationState,
  shouldEmitGamePatchForTurn,
  heartbeatPropensity,
  resolveHeartbeatCadenceProfile,
  type RatingEvent,
  type RatingRefreshEvent
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

function buildHeartbeatBootstrap(seed = 97531) {
  const dataset = generateColumbusDataset({
    seed,
    numUsers: 1,
    numIslands: 1,
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

function buildHeartbeatPolicy(overrides: Partial<HeartbeatPolicy> = {}) {
  return {
    ...DEFAULT_HEARTBEAT_POLICY,
    ...overrides,
    islandCadenceProfileWeights: {
      ...DEFAULT_HEARTBEAT_POLICY.islandCadenceProfileWeights,
      ...(overrides.islandCadenceProfileWeights ?? {})
    }
  };
}

function buildSignalWeights(bootstrap: ReturnType<typeof buildBootstrap>, defaultWeight = 1) {
  return Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, defaultWeight])) as Record<string, number>;
}

function roundNumber(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function visibleUserWithEvents(events: RatingEvent[], index = 0) {
  const bootstrap = buildBootstrap();
  const [user] = deriveVisibleUsersFromEvents([bootstrap.latentUsers[index]], bootstrap.islands, events);
  assert.ok(user);
  return { bootstrap, user };
}

function makeTurnSummary(turn: number) {
  return {
    turn,
    mode: 'organic' as const,
    participatingUserIds: [],
    ratingsCreated: 0,
    organicRatingsCreated: 0,
    guidedRatingsCreated: 0,
    newlyRatedIslandIds: [],
    routedIslandIds: [],
    recommendationKinds: {
      SAFE_FIT: 0,
      SMART_GAMBLE: 0,
      DISCOVERY_PROBE: 0
    },
    diagnosisCounts: {
      HIGH_SIGNAL: 0,
      MISMATCH_RETAG: 0,
      INVERSE_PROFILE: 0,
      UNKNOWN_OR_NOISY: 0,
      LOW_SIGNAL: 0,
      AMBIGUOUS: 0,
      UNEXPLAINED_PREDICTIVE: 0
    }
  };
}

describe('simulation layer', () => {
  it('emits scheduled heartbeat patches and deterministic island updates', () => {
    const bootstrap = buildHeartbeatBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const patchPolicy = buildHeartbeatPolicy({
      gamePatchEveryNTurns: 2,
      gamePatchTurnOffset: 1
    });
    const islandPolicy = buildHeartbeatPolicy({
      maxIslandInspectionsPerTurn: 1,
      maxIslandUpdatesPerTurn: 1,
      islandCadenceProfileWeights: {
        dormant: 0,
        slow: 0,
        steady: 0,
        active: 0,
        frenetic: 1
      }
    });

    assert.equal(shouldEmitGamePatchForTurn(1, patchPolicy), true);
    assert.equal(shouldEmitGamePatchForTurn(2, patchPolicy), false);
    assert.equal(shouldEmitGamePatchForTurn(3, patchPolicy), true);

    const first = buildHeartbeatRefreshEvents(state, 1, islandPolicy);
    const second = buildHeartbeatRefreshEvents(state, 1, islandPolicy);

    assert.deepEqual(first, second);
  });

  it('treats cadence profiles as ordered propensity bands', () => {
    assert.equal(heartbeatPropensity('dormant') < heartbeatPropensity('slow'), true);
    assert.equal(heartbeatPropensity('slow') < heartbeatPropensity('steady'), true);
    assert.equal(heartbeatPropensity('steady') < heartbeatPropensity('active'), true);
    assert.equal(heartbeatPropensity('active') < heartbeatPropensity('frenetic'), true);

    const bootstrap = buildHeartbeatBootstrap(97532);
    const dormantPolicy = buildHeartbeatPolicy({
      islandCadenceProfileWeights: {
        dormant: 1,
        slow: 0,
        steady: 0,
        active: 0,
        frenetic: 0
      }
    });
    const freneticPolicy = buildHeartbeatPolicy({
      islandCadenceProfileWeights: {
        dormant: 0,
        slow: 0,
        steady: 0,
        active: 0,
        frenetic: 1
      }
    });

    assert.equal(resolveHeartbeatCadenceProfile(bootstrap.seed, bootstrap.islands[0], dormantPolicy), 'dormant');
    assert.equal(resolveHeartbeatCadenceProfile(bootstrap.seed, bootstrap.islands[0], freneticPolicy), 'frenetic');
  });

  it('allows repeated nearby island updates without cooldown and respects update caps', () => {
    const bootstrap = buildHeartbeatBootstrap(97533);
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const policy = buildHeartbeatPolicy({
      maxIslandInspectionsPerTurn: 1,
      maxIslandUpdatesPerTurn: 1,
      islandCadenceProfileWeights: {
        dormant: 0,
        slow: 0,
        steady: 0,
        active: 0,
        frenetic: 1
      }
    });

    let turnOne: ReturnType<typeof buildHeartbeatRefreshEvents> | null = null;
    let turnTwo: ReturnType<typeof buildHeartbeatRefreshEvents> | null = null;

    for (let seed = 1; seed < 5000; seed += 1) {
      const candidateBootstrap = buildHeartbeatBootstrap(seed);
      const candidateState = createInitialSimulationState({ ...candidateBootstrap, initialRatingsPerUser: 0 });
      const first = buildHeartbeatRefreshEvents(candidateState, 1, policy);
      const second = buildHeartbeatRefreshEvents(candidateState, 2, policy);
      if (first.some((event) => event.kind === 'islandUpdate') && second.some((event) => event.kind === 'islandUpdate')) {
        turnOne = first;
        turnTwo = second;
        break;
      }
    }

    assert.ok(turnOne);
    assert.ok(turnTwo);
    assert.equal(turnOne?.filter((event) => event.kind === 'islandUpdate').length, 1);
    assert.equal(turnTwo?.filter((event) => event.kind === 'islandUpdate').length, 1);
    assert.equal(turnOne?.[0]?.kind, 'islandUpdate');
    assert.equal(turnTwo?.[0]?.kind, 'islandUpdate');
    assert.equal(turnOne?.[0]?.islandId, turnTwo?.[0]?.islandId);

    const cappedPolicy = buildHeartbeatPolicy({
      maxIslandInspectionsPerTurn: 0,
      maxIslandUpdatesPerTurn: 0
    });
    const capped = buildHeartbeatRefreshEvents(state, 1, cappedPolicy);
    assert.equal(capped.length, 0);
  });

  it('emits heartbeat refreshes before rating generation in advancePolicyTurn', () => {
    const bootstrap = buildHeartbeatBootstrap(97534);
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const next = advancePolicyTurn(state, {
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
      customBadFitGuardThreshold: -1,
      heartbeat: buildHeartbeatPolicy({
        gamePatchEveryNTurns: 1,
        gamePatchTurnOffset: 1,
        maxIslandInspectionsPerTurn: 0,
        maxIslandUpdatesPerTurn: 0
      })
    });

    assert.ok(next.refreshEvents.length > 0);
    assert.equal(next.turnHistory.at(-1)?.refreshEventsCreated ?? 0, next.refreshEvents.length);
    assert.equal(next.turnHistory.at(-1)?.gamePatchRefreshEventsCreated ?? 0, 1);
    assert.equal(next.ratingEvents.every((event) => event.gameRulesVersionId === 'game-rules-v1'), true);
  });

  it('starts sparse at turn 0 when no initial ratings are seeded', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });

    assert.equal(state.currentTurn, 0);
    assert.equal(state.ratingEvents.length, 0);
    assert.equal(state.confidenceSnapshots.length, state.islands.length * state.cohorts.length);
    assert.equal(state.islandCohortRatingSnapshots.length, state.islands.length * state.cohorts.length);
    assert.equal(state.confidenceSnapshots.every((snapshot) => snapshot.turn === 0), true);
    assert.equal(state.islandCohortRatingSnapshots.every((snapshot) => snapshot.turn === 0), true);
    assert.equal(
      state.users.every((user) => Object.values(user.ratings).every((rating) => rating === null)),
      true
    );
  });

  it('bootstraps turn 0 ratings without trusted cohort signal weights', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
    const firstEvent = state.ratingEvents[0];

    assert.ok(firstEvent);
    assert.equal(firstEvent.turn, 0);
    assert.equal(
      Object.values(firstEvent.raterSignalWeights).every((weight) => weight === 0),
      true
    );
  });

  it('keeps pre-refresh ratings historical while allowing a refreshed island to be rated again', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const userId = bootstrap.latentUsers[0].id;
    const islandId = bootstrap.islands[0].id;
    const firstEvent: RatingEvent = {
      id: 'refresh-demo:event-0',
      turn: 0,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const refreshEvent: RatingRefreshEvent = {
      id: 'refresh-demo:patch-1',
      turn: 1,
      kind: 'gamePatch',
      reason: 'system patch'
    };
    const refreshedState = appendRefreshEvent({
      ...state,
      ratingEvents: [firstEvent],
      refreshEvents: []
    } as typeof state, refreshEvent);
    const secondEvent: RatingEvent = {
      id: 'refresh-demo:event-1',
      turn: 2,
      userId,
      islandId,
      rating: -1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      revisionReason: 'gamePatchRefresh',
      supersedesEventId: firstEvent.id,
      islandVersionId: 'island:' + islandId + ':v1',
      gameRulesVersionId: 'game-rules-v1'
    };
    const recomputed = recomputeSimulationStateFromCanonicalEvents({
      seed: refreshedState.seed,
      allTags: refreshedState.allTags,
      latentUsers: refreshedState.latentUsers,
      cohorts: refreshedState.cohorts,
      islands: refreshedState.islands,
      ratingEvents: [firstEvent, secondEvent],
      refreshEvents: [refreshEvent],
      turnHistory: [makeTurnSummary(0), makeTurnSummary(2)],
      hiddenTasteCohorts: refreshedState.hiddenTasteCohorts
    });

    assert.equal(recomputed.ratingEvents.length, 2);
    assert.equal(recomputed.users[0]?.ratings[islandId], -1);
    assert.equal(recomputed.ratingEvents[0]?.rating, 1);
    assert.equal(recomputed.ratingEvents[1]?.supersedesEventId, firstEvent.id);
  });

  it('uses only the latest active rating for a user-island pair when multiple current-version ratings exist', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const userId = bootstrap.latentUsers[0].id;
    const islandId = bootstrap.islands[0].id;
    const firstEvent: RatingEvent = {
      id: 'duplicate-active:event-0',
      turn: 0,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const secondEvent: RatingEvent = {
      id: 'duplicate-active:event-1',
      turn: 2,
      userId,
      islandId,
      rating: -1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const recomputed = recomputeSimulationStateFromCanonicalEvents({
      seed: state.seed,
      allTags: state.allTags,
      latentUsers: state.latentUsers,
      cohorts: state.cohorts,
      islands: state.islands,
      ratingEvents: [firstEvent, secondEvent],
      turnHistory: [makeTurnSummary(0), makeTurnSummary(2)],
      hiddenTasteCohorts: state.hiddenTasteCohorts
    });

    assert.equal(recomputed.users[0]?.ratings[islandId], -1);
    assert.equal(recomputed.islandAffinityReports.get(islandId)?.estimates[0]?.rawCount ?? 0, 1);
  });

  it('treats same-score post-refresh ratings as new active revisions', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const userId = bootstrap.latentUsers[1].id;
    const islandId = bootstrap.islands[1].id;
    const firstEvent: RatingEvent = {
      id: 'same-score:event-0',
      turn: 0,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const refreshEvent: RatingRefreshEvent = {
      id: 'same-score:patch-1',
      turn: 1,
      kind: 'gamePatch',
      reason: 'patch'
    };
    const refreshedState = appendRefreshEvent({
      ...state,
      ratingEvents: [firstEvent],
      refreshEvents: []
    } as typeof state, refreshEvent);
    const secondEvent: RatingEvent = {
      id: 'same-score:event-1',
      turn: 2,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v1',
      gameRulesVersionId: 'game-rules-v1'
    };
    const recomputed = recomputeSimulationStateFromCanonicalEvents({
      seed: refreshedState.seed,
      allTags: refreshedState.allTags,
      latentUsers: refreshedState.latentUsers,
      cohorts: refreshedState.cohorts,
      islands: refreshedState.islands,
      ratingEvents: [firstEvent, secondEvent],
      refreshEvents: [refreshEvent],
      turnHistory: [makeTurnSummary(0), makeTurnSummary(2)],
      hiddenTasteCohorts: refreshedState.hiddenTasteCohorts
    });

    assert.equal(recomputed.users[1]?.ratings[islandId], 1);
    assert.equal(recomputed.islandAffinityReports.get(islandId)?.estimates[0]?.rawCount ?? 0, 1);
  });

  it('applies island-local refreshes without changing the rest of the system', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const userId = bootstrap.latentUsers[1].id;
    const islandId = bootstrap.islands[1].id;
    const firstEvent: RatingEvent = {
      id: 'refresh-demo:island:event-0',
      turn: 0,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const islandRefresh: RatingRefreshEvent = {
      id: 'refresh-demo:island-update-1',
      turn: 1,
      kind: 'islandUpdate',
      islandId,
      reason: 'creator update'
    };
    const refreshedState = appendRefreshEvent({
      ...state,
      ratingEvents: [firstEvent],
      refreshEvents: []
    } as typeof state, islandRefresh);
    const secondEvent: RatingEvent = {
      id: 'refresh-demo:island:event-1',
      turn: 2,
      userId,
      islandId,
      rating: -1,
      source: 'guided',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      revisionReason: 'islandUpdateRefresh',
      supersedesEventId: firstEvent.id,
      islandVersionId: 'island:' + islandId + ':v1',
      gameRulesVersionId: 'game-rules-v0'
    };
    const recomputed = recomputeSimulationStateFromCanonicalEvents({
      seed: refreshedState.seed,
      allTags: refreshedState.allTags,
      latentUsers: refreshedState.latentUsers,
      cohorts: refreshedState.cohorts,
      islands: refreshedState.islands,
      ratingEvents: [firstEvent, secondEvent],
      refreshEvents: [islandRefresh],
      turnHistory: [makeTurnSummary(0), makeTurnSummary(2)],
      hiddenTasteCohorts: refreshedState.hiddenTasteCohorts
    });

    assert.equal(recomputed.users[1]?.ratings[islandId], -1);
    assert.equal(recomputed.ratingEvents[0]?.rating, 1);
    assert.equal(recomputed.ratingEvents[1]?.supersedesEventId, firstEvent.id);
    assert.equal(recomputed.users[1]?.ratings[bootstrap.islands[0].id] ?? null, null);
  });

  it('stays refresh-aware when hydrating without stored confidence snapshots', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const userId = bootstrap.latentUsers[2].id;
    const islandId = bootstrap.islands[2].id;
    const initialEvent: RatingEvent = {
      id: 'hydrate-refresh:event-0',
      turn: 0,
      userId,
      islandId,
      rating: 1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      islandVersionId: 'island:' + islandId + ':v0',
      gameRulesVersionId: 'game-rules-v0'
    };
    const refreshEvent: RatingRefreshEvent = {
      id: 'hydrate-refresh:patch-1',
      turn: 1,
      kind: 'gamePatch',
      reason: 'patch'
    };
    const refreshed = appendRefreshEvent({
      ...state,
      ratingEvents: [initialEvent],
      refreshEvents: []
    } as typeof state, refreshEvent);
    const updatedEvent: RatingEvent = {
      id: 'hydrate-refresh:event-1',
      turn: 2,
      userId,
      islandId,
      rating: -1,
      source: 'organic',
      raterSignalWeights: Object.fromEntries(bootstrap.cohorts.map((cohort) => [cohort.id, 0])) as Record<string, number>,
      revisionReason: 'gamePatchRefresh',
      supersedesEventId: initialEvent.id,
      islandVersionId: 'island:' + islandId + ':v1',
      gameRulesVersionId: 'game-rules-v1'
    };
    const legacySerialized = {
      ...serializeSimulationState(refreshed),
      turnHistory: [makeTurnSummary(0), makeTurnSummary(2)],
      confidenceSnapshots: undefined,
      islandCohortRatingSnapshots: undefined
    };
    const hydrated = hydrateSimulationState({
      ...legacySerialized,
      ratingEvents: [initialEvent, updatedEvent]
    });

    assert.equal(hydrated.users[2]?.ratings[islandId], -1);
    assert.equal(hydrated.confidenceSnapshots.some((snapshot) => snapshot.turn === 2), true);
    assert.equal(hydrated.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0).length > 0, true);
    assert.equal(
      hydrated.islandAffinityReports.get(islandId)?.estimates.every((estimate) => estimate.rawCount === 1),
      true
    );
  });

  it('appends turn-boundary snapshots without rebuilding earlier turns', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const turnZeroConfidence = state.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0);
    const turnZeroRating = state.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === 0);
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
      customBadFitGuardThreshold: -1
    });

    assert.equal(next.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0).length, turnZeroConfidence.length);
    assert.equal(next.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === 0).length, turnZeroRating.length);
    assert.equal(next.confidenceSnapshots.filter((snapshot) => snapshot.turn === 1).length, bootstrap.islands.length * bootstrap.cohorts.length);
    assert.equal(next.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === 1).length, bootstrap.islands.length * bootstrap.cohorts.length);
    assert.deepEqual(next.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0), turnZeroConfidence);
    assert.deepEqual(next.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === 0), turnZeroRating);
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
      customBadFitGuardThreshold: -1
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
    assert.equal(next.islandCohortRatingSnapshots.length, next.islands.length * next.cohorts.length * 2);
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
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
      observedBehaviorEvents: undefined,
      islandCohortRatingSnapshots: undefined,
      confidenceSnapshots: undefined
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
    assert.deepEqual(restored.observedBehaviorEvents, state.observedBehaviorEvents);
    assert.deepEqual(legacyRestored.observedBehaviorEvents, state.observedBehaviorEvents);
    assert.ok(fallbackRestored.observedBehaviorEvents.length > 0);
    assert.deepEqual(fallbackRestored.islandCohortRatingSnapshots, state.islandCohortRatingSnapshots);
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
    });
    const secondEvent = secondTurn.ratingEvents.at(-1);
    const firstProfile = firstTurn.raterSignalProfiles.get(firstEvent.userId);
    const trackedCohortId =
      firstProfile?.topCohortId ??
      Object.entries(firstProfile?.cohortWeights ?? {}).find(([, weight]) => weight > 0)?.[0] ??
      null;

    assert.ok(secondEvent);
    assert.ok((secondTurn.raterSignalProfiles.get(secondEvent.userId)?.overallSignal ?? 0) > 0);
    assert.ok(trackedCohortId);
    assert.equal(secondEvent.raterSignalWeights[trackedCohortId ?? ''], firstProfile?.cohortWeights[trackedCohortId ?? ''] ?? 0);

    const secondEstimate = secondTurn.islandAffinityReports
      .get(secondEvent.islandId)
      ?.estimates.find((entry) => entry.cohortId === trackedCohortId);
    const secondContribution = secondEstimate?.contributions.find((entry) => entry.userId === secondEvent.userId);

    assert.ok((secondContribution?.raterSignal ?? 0) > 0);
    assert.ok((secondEstimate?.effectiveWeight ?? 0) > 0);
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
          { explorationWeight: 0.55, highConfidenceBadFitThreshold: -1, topLimit: 8 }
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
      customBadFitGuardThreshold: -1
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

  it('matches a full recompute from canonical evidence after incremental advancement', () => {
    const bootstrap = buildBootstrap(24681);
    const initial = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 2 });
    const turnConfig = {
      turnMode: 'mixed' as const,
      participationModel: 'fixed-count' as const,
      participatingUsersPerTurn: 2,
      participationChance: 0.5,
      organicRatingCountModel: 'fixed-count' as const,
      organicRatingsPerUser: 1,
      organicRatingDice: '1d2' as const,
      guidedRatingCountModel: 'fixed-count' as const,
      guidedRecommendationsPerUser: 1,
      guidedRecommendationDice: '1d2' as const,
      routingRiskProfile: 'custom' as const,
      customExplorationWeight: 0.75,
      customBadFitGuardThreshold: -1
    };

    const afterOne = advancePolicyTurn(initial, turnConfig);
    const afterTwo = advancePolicyTurn(afterOne, turnConfig);
    const afterThree = advancePolicyTurn(afterTwo, turnConfig);
    const recomputed = recomputeSimulationStateFromCanonicalEvents({
      seed: afterThree.seed,
      allTags: afterThree.allTags,
      latentUsers: afterThree.latentUsers,
      cohorts: afterThree.cohorts,
      islands: afterThree.islands,
      hiddenTasteCohorts: afterThree.hiddenTasteCohorts,
      ratingEvents: afterThree.ratingEvents,
      turnHistory: afterThree.turnHistory,
      observedBehaviorEvents: afterThree.observedBehaviorEvents
    });

    assert.equal(recomputed.currentTurn, afterThree.currentTurn);
    assert.deepEqual(recomputed.ratingEvents, afterThree.ratingEvents);
    assert.deepEqual(recomputed.observedBehaviorEvents, afterThree.observedBehaviorEvents);
    assert.deepEqual(recomputed.users, afterThree.users);
    assert.equal(recomputed.islandCohortRatingSnapshots.length, afterThree.islandCohortRatingSnapshots.length);
    assert.equal(recomputed.confidenceSnapshots.length, afterThree.confidenceSnapshots.length);
    assert.equal(
      recomputed.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === afterThree.currentTurn).length,
      afterThree.islandCohortRatingSnapshots.filter((snapshot) => snapshot.turn === afterThree.currentTurn).length
    );
    assert.equal(
      recomputed.confidenceSnapshots.filter((snapshot) => snapshot.turn === afterThree.currentTurn).length,
      afterThree.confidenceSnapshots.filter((snapshot) => snapshot.turn === afterThree.currentTurn).length
    );
    assert.deepEqual(
      Array.from(recomputed.raterSignalProfiles.values()).map((profile) => ({
        ...profile,
        cohortWeights: Object.fromEntries(Object.entries(profile.cohortWeights).map(([key, value]) => [key, roundNumber(value)])),
        signalEvidence: roundNumber(profile.signalEvidence),
        overallSignal: roundNumber(profile.overallSignal)
      })),
      Array.from(afterThree.raterSignalProfiles.values()).map((profile) => ({
        ...profile,
        cohortWeights: Object.fromEntries(Object.entries(profile.cohortWeights).map(([key, value]) => [key, roundNumber(value)])),
        signalEvidence: roundNumber(profile.signalEvidence),
        overallSignal: roundNumber(profile.overallSignal)
      }))
    );
    assert.deepEqual(
      Array.from(recomputed.islandAffinityReports.values()).map((report) => {
        const topEstimate = report.estimates[0];
        return {
          islandId: report.islandId,
          estimateCount: report.estimates.length,
          topCohortId: topEstimate?.cohortId ?? null,
          topAffinity: topEstimate ? roundNumber(topEstimate.affinity) : 0,
          topConfidence: topEstimate ? roundNumber(topEstimate.confidence) : 0
        };
      }),
      Array.from(afterThree.islandAffinityReports.values()).map((report) => {
        const topEstimate = report.estimates[0];
        return {
          islandId: report.islandId,
          estimateCount: report.estimates.length,
          topCohortId: topEstimate?.cohortId ?? null,
          topAffinity: topEstimate ? roundNumber(topEstimate.affinity) : 0,
          topConfidence: topEstimate ? roundNumber(topEstimate.confidence) : 0
        };
      })
    );
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
      customBadFitGuardThreshold: -1
    });

    assert.equal(next.turnHistory.at(-1)?.mode, 'mixed');
    assert.ok((next.turnHistory.at(-1)?.ratingsCreated ?? 0) > 0);
    assert.ok((next.turnHistory.at(-1)?.organicRatingsCreated ?? 0) >= 0);
    assert.ok((next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) > 0);
    assert.equal(
      next.ratingEvents.slice(state.ratingEvents.length).every((event) => event.source === 'organic' || event.source === 'guided'),
      true
    );
    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);
    const freshPairs = new Set(freshEvents.map((event) => `${event.userId}:${event.islandId}`));
    assert.equal(freshPairs.size, freshEvents.length);
  });

  it('lets mixed mode reserve separate organic and guided user capacity', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
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
      customBadFitGuardThreshold: -1
    });

    assert.ok((next.turnHistory.at(-1)?.participatingUserIds.length ?? 0) <= 4);
    assert.ok((next.turnHistory.at(-1)?.organicRatingsCreated ?? 0) > 0);
    assert.ok((next.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) > 0);
  });

  it('records mixed participants as the union of organic and guided selections', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 6 });
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
      customBadFitGuardThreshold: -1
    });

    const freshEvents = next.ratingEvents.slice(state.ratingEvents.length);
    const participantIds = new Set(next.turnHistory.at(-1)?.participatingUserIds ?? []);

    assert.equal(participantIds.size <= 4, true);
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
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
      customBadFitGuardThreshold: -1
    });

    assert.ok((organicOnly.turnHistory.at(-1)?.organicRatingsCreated ?? 0) > 0);
    assert.equal(organicOnly.turnHistory.at(-1)?.guidedRatingsCreated ?? 0, 0);
    assert.equal(guidedOnly.turnHistory.at(-1)?.organicRatingsCreated ?? 0, 0);
    assert.ok((guidedOnly.turnHistory.at(-1)?.guidedRatingsCreated ?? 0) > 0);
  });

  it('does not collapse Golden Demo learned confidence after rating saturation creates zero-event turns', () => {
    const preset = getScenarioPreset('golden-demo');
    const dataset = generateColumbusDataset({
      ...preset.generatorConfig,
      allTags: DEFAULT_TAGS,
      cohorts: createDefaultCohorts()
    });
    let state = createInitialSimulationState({
      seed: preset.generatorConfig.seed,
      allTags: dataset.allTags,
      latentUsers: dataset.users,
      cohorts: dataset.cohorts,
      islands: dataset.islands,
      hiddenTasteCohorts: dataset.hiddenTasteCohorts,
      initialRatingsPerUser: preset.generatorConfig.bootstrapRatingsPerUser
    });
    let saturationState = state;

    for (let turn = 1; turn <= 54; turn += 1) {
      state = advancePolicyTurn(state, preset.turnPolicy);
      if ((state.turnHistory.at(-1)?.ratingsCreated ?? 0) > 0) {
        saturationState = state;
      }
    }

    const saturationAverageConfidence = average(saturationState.islandCohortRatingSnapshots.map((snapshot) => snapshot.confidence));
    const finalAverageConfidence = average(state.islandCohortRatingSnapshots.map((snapshot) => snapshot.confidence));
    const zeroEventTail = state.turnHistory
      .slice(saturationState.turnHistory.length)
      .every((summary) => summary.ratingsCreated === 0);

    assert.ok(state.currentTurn > saturationState.currentTurn);
    assert.equal(zeroEventTail, true);
    assert.ok(finalAverageConfidence >= saturationAverageConfidence * 0.95);
  });
});

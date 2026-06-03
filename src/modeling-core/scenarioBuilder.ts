import type {
  IslandTasteModel,
  ModelingCoreState,
  ModelingFixtureOracle,
  ModelingFixtureState,
  PlayerPreferenceModel,
  PlayerSignalModel,
  RatingEvent,
  RatingEvidenceProjection,
  RatingLedgerEntry,
  TagId,
  HiddenTruthChecksum,
  ExpectedSeedRelation
} from './types.js';
import {
  DEFAULT_SCENARIO_TAGS,
  disconnectedActor,
  ratingFromHiddenTruth,
  scenarioVector,
  seedActor,
  seedFitIsland,
  seedLikeActor,
  inverseSeedLikeActor,
  type ScenarioActorTruth,
  type ScenarioIslandTruth
} from './scenarioTruth.js';
import { ensureEncounter, rewriteActorTruth, rewriteIslandTruth, type ScenarioEncounterInjection, type ScenarioInjection } from './scenarioInjections.js';
import { generateRatingEventFromEncounter } from './scenarioRatingGenerator.js';

function uniformVector(value: number, tags: readonly TagId[] = DEFAULT_SCENARIO_TAGS): Record<TagId, number> {
  return Object.fromEntries(tags.map((tag) => [tag, value])) as Record<TagId, number>;
}

function signalModel(sourceAuthority: number, usefulness: number, rd: number, alignment: number): PlayerSignalModel {
  return {
    trustEstimate: usefulness,
    trustRD: rd,
    signalVolatility: 0.12,
    sourceAuthority,
    laneSignalByTag: uniformVector(usefulness),
    signalUsefulnessByTag: uniformVector(usefulness),
    signalAlignmentByTag: uniformVector(alignment),
    signalRDByTag: uniformVector(rd),
    signalVolatilityByTag: uniformVector(0.12)
  };
}

function visiblePlayerFromTruth(truth: ScenarioActorTruth): PlayerPreferenceModel {
  const isSeed = truth.behaviorArchetype === 'seed';
  const visibleAffinity = isSeed ? truth.preferenceByTag : scenarioVector({ 'skill-based': 0.35, 'co-op': 0.05, 'fast-session': 0.05, 'brain-rot': -0.05, cozy: 0, social: 0 });
  return {
    id: truth.actorId,
    label: truth.label,
    declaredAffinityByTag: { ...visibleAffinity },
    demonstratedAffinityByTag: { ...visibleAffinity },
    activeRoutingAffinityByTag: { ...visibleAffinity },
    preferenceRDByTag: uniformVector(isSeed ? 0.06 : 0.82),
    signalModel: isSeed ? signalModel(1.45, 0.98, 0.04, 0.95) : signalModel(1, 0.14, 0.86, 0.1)
  };
}

function visibleIslandFromTruth(truth: ScenarioIslandTruth): IslandTasteModel {
  return {
    id: truth.islandId,
    label: truth.label,
    descriptiveTagProfile: truth.descriptiveTagProfile ? { ...truth.descriptiveTagProfile } : scenarioVector({}),
    audienceFitByTag: scenarioVector({}),
    audienceFitRDByTag: uniformVector(0.84),
    audienceFitVolatilityByTag: uniformVector(0.12),
    rawObservations: { positiveCount: 0, neutralCount: 0, negativeCount: 0 }
  };
}

function seedLedgerEntry(scenarioId: string, seed: ScenarioActorTruth, island: ScenarioIslandTruth, index: number): RatingLedgerEntry {
  const eventId = `${scenarioId}:seed-${seed.actorId}:rating-${index + 1}`;
  return {
    entryId: `${eventId}:ledger`,
    eventId,
    playerId: seed.actorId,
    islandId: island.islandId,
    rating: ratingFromHiddenTruth(seed, island),
    focusTag: island.laneScope[0],
    focusMeaning: 'expectationFulfillment',
    source: 'organic',
    selectionReason: 'highValueScoutOpportunity',
    turn: 1,
    reason: 'initialRating'
  };
}

function seedProjection(entry: RatingLedgerEntry): RatingEvidenceProjection {
  return {
    projectionId: `${entry.entryId}:projection`,
    ledgerEntryId: entry.entryId,
    activeForCurrentIslandVersion: true,
    versionCompatibility: 1,
    temporalDecayMultiplier: 1,
    supersededByPlayer: false,
    contributesToIslandEstimate: true,
    contributesToPlayerSignalLearning: true,
    sourceClass: 'cohortSeed',
    authorityBasis: 'directSeed',
    proxyForSeedIds: [],
    proxyStrengthBySeed: {},
    signalStrength: 0.95,
    polarity: entry.rating,
    trainingEligible: entry.rating !== 0,
    eventTurn: entry.turn,
    readModelStateTurn: 0,
    projectedTurn: entry.turn,
    calculatedAtTurn: entry.turn,
    modelVersion: 'modeling-core-v12a-scenario-seed'
  };
}

function seedEventFromEntry(entry: RatingLedgerEntry): RatingEvent {
  return {
    id: entry.eventId,
    turn: entry.turn,
    userId: entry.playerId,
    islandId: entry.islandId,
    rating: entry.rating,
    source: entry.source,
    focusTag: entry.focusTag,
    focusMeaning: entry.focusMeaning,
    selectionReason: entry.selectionReason
  };
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly description: string;
  readonly tags: TagId[];
  readonly actors: Record<string, ScenarioActorTruth>;
  readonly islands: Record<string, ScenarioIslandTruth>;
  readonly seedRatingIslandIds: string[];
  readonly encounters: ScenarioEncounterInjection[];
  readonly expectedBehavior: string[];
  readonly hiddenTruthChecksum?: HiddenTruthChecksum;
}

export interface ScenarioBuildResult {
  readonly fixture: ModelingFixtureState;
  readonly generatedEvents: RatingEvent[];
}

function applyInjections(base: ScenarioDefinition, injections: readonly ScenarioInjection[]): ScenarioDefinition {
  const actors = { ...base.actors };
  const islands = { ...base.islands };
  const encounters = base.encounters.slice();

  for (const injection of injections) {
    if (injection.type === 'rewriteActorTruth') {
      actors[injection.actorId] = injection.truth;
    } else if (injection.type === 'rewriteIslandTruth') {
      islands[injection.islandId] = injection.truth;
    } else {
      encounters.push(injection.encounter);
    }
  }

  return { ...base, actors, islands, encounters };
}

function validateScenario(definition: ScenarioDefinition): void {
  const seenActorIslandTurn = new Set<string>();
  for (const encounter of definition.encounters) {
    if (!definition.actors[encounter.actorId]) {
      throw new Error(`Scenario ${definition.id} encounter references unknown actor ${encounter.actorId}.`);
    }
    if (!definition.islands[encounter.islandId]) {
      throw new Error(`Scenario ${definition.id} encounter references unknown island ${encounter.islandId}.`);
    }
    const key = `${encounter.turn}:${encounter.actorId}:${encounter.islandId}`;
    if (seenActorIslandTurn.has(key)) {
      throw new Error(`Scenario ${definition.id} has duplicate encounter ${key}.`);
    }
    seenActorIslandTurn.add(key);
  }
}


function expectedRelationForActor(actor: ScenarioActorTruth): ExpectedSeedRelation {
  if (actor.behaviorArchetype === 'seed') {
    return 'seed';
  }
  if (actor.behaviorArchetype === 'seedLike' && (actor.seedSimilarity ?? 0) >= 0.95) {
    return 'seedProxy';
  }
  if (actor.behaviorArchetype === 'almostSeedLike') {
    return 'ordinarySimilar';
  }
  if (actor.behaviorArchetype === 'inverseSeedLike') {
    return 'inverseSignal';
  }
  return 'unrelated';
}

function hiddenSimilarityForActor(actor: ScenarioActorTruth): number {
  if (actor.behaviorArchetype === 'inverseSeedLike') {
    return -(actor.inverseSimilarity ?? 1);
  }
  return actor.seedSimilarity ?? (actor.behaviorArchetype === 'seed' ? 1 : 0);
}

function createHiddenTruthChecksum(definition: ScenarioDefinition): HiddenTruthChecksum {
  const seedRatedIslandIds = new Set(definition.seedRatingIslandIds);
  return {
    scenarioId: definition.id,
    oraclePolicy: {
      hiddenTruthMayGenerateEvents: true,
      hiddenTruthMayValidateOutcomes: true,
      hiddenTruthMayNotDriveModelInference: true
    },
    actors: Object.fromEntries(Object.values(definition.actors).map((actor) => [actor.actorId, {
      actorId: actor.actorId,
      label: actor.label,
      ...(actor.seedReferenceId ? { seedPlayerId: actor.seedReferenceId } : {}),
      expectedRelationToSeed: expectedRelationForActor(actor),
      laneScope: actor.laneScope.slice(),
      hiddenSimilarity: hiddenSimilarityForActor(actor),
      explanation: actor.notes ?? `${actor.label} hidden truth checksum.`
    }])),
    islands: Object.fromEntries(Object.values(definition.islands).map((island) => [island.islandId, {
      islandId: island.islandId,
      label: island.label,
      expectedSeedFitById: { ...island.intendedSeedFitById },
      seedActuallyRated: seedRatedIslandIds.has(island.islandId),
      laneScope: island.laneScope.slice(),
      truthClass: island.truthClass
    }]))
  };
}

export function buildModelingFixtureFromScenario(base: ScenarioDefinition, injections: readonly ScenarioInjection[] = []): ScenarioBuildResult {
  const definition = applyInjections(base, injections);
  validateScenario(definition);

  const seed = Object.values(definition.actors).find((actor) => actor.behaviorArchetype === 'seed');
  if (!seed) {
    throw new Error(`Scenario ${definition.id} requires a seed actor.`);
  }

  const players = Object.values(definition.actors).map(visiblePlayerFromTruth);
  const islands = Object.values(definition.islands).map(visibleIslandFromTruth);
  const seedIslands = definition.seedRatingIslandIds.map((id) => definition.islands[id]).filter((entry): entry is ScenarioIslandTruth => Boolean(entry));
  const seedEntries = seedIslands.map((island, index) => seedLedgerEntry(definition.id, seed, island, index));
  const seedEvents = seedEntries.map(seedEventFromEntry);
  const generatedEvents = definition.encounters
    .slice()
    .sort((left, right) => left.turn - right.turn || left.actorId.localeCompare(right.actorId) || left.islandId.localeCompare(right.islandId))
    .map((encounter, index) => generateRatingEventFromEncounter(definition.id, index, encounter, definition.actors[encounter.actorId]!, definition.islands[encounter.islandId]!));

  const state: ModelingCoreState = {
    allTags: definition.tags.slice(),
    players,
    islands,
    ratingEvents: seedEvents,
    ratingLedger: seedEntries,
    evidenceProjections: seedEntries.map(seedProjection),
    dirtyProjections: []
  };

  const oracle: ModelingFixtureOracle = {
    hiddenPlayers: Object.fromEntries(Object.values(definition.actors).map((actor) => [actor.actorId, actor])),
    hiddenIslands: Object.fromEntries(Object.values(definition.islands).map((island) => [island.islandId, island])),
    expectedBehavior: definition.expectedBehavior,
    hiddenTruthChecksum: definition.hiddenTruthChecksum ?? createHiddenTruthChecksum(definition)
  };

  return {
    generatedEvents,
    fixture: {
      initialState: state,
      ratingEvents: generatedEvents,
      description: definition.description,
      oracle
    }
  };
}

export function goldenSeedProxyBaseline(): ScenarioDefinition {
  const alice = seedActor('scenario-alice', 'Scenario Alice', scenarioVector({ 'skill-based': 0.98, 'co-op': 0.18, 'fast-session': 0.08, 'brain-rot': -0.82, cozy: -0.18, social: 0.08 }), ['skill-based']);
  const bob = disconnectedActor('scenario-bob', 'Scenario Bob');
  const alicePositiveUnrated = seedFitIsland('scenario-alice-positive-unrated', 'Alice-positive unrated island', alice, 1, 'seedPositiveUnrated', ['skill-based']);
  const overlapIslandIds = Array.from({ length: 15 }, (_, index) => `scenario-overlap-${index + 1}`);
  const postProxyIsland = seedFitIsland('scenario-post-proxy', 'Post-proxy trigger island', alice, 1, 'overlapCalibration', ['skill-based']);
  const islands = Object.fromEntries([
    [alicePositiveUnrated.islandId, alicePositiveUnrated],
    [postProxyIsland.islandId, postProxyIsland],
    ...overlapIslandIds.map((id, index) => [id, seedFitIsland(id, `Alice/Bob overlap island ${index + 1}`, alice, 1, 'overlapCalibration', ['skill-based'])] as const)
  ]);

  return {
    id: 'proxy-discovers-seed-positive-unrated-island',
    description: 'Scenario script: Bob is rewritten as Alice-like, autonomously discovers an Alice-positive island Alice never rated, earns proxy authority on overlap, then that prior rating is reprojected next turn.',
    tags: DEFAULT_SCENARIO_TAGS.slice(),
    actors: { alice, bob },
    islands,
    seedRatingIslandIds: overlapIslandIds,
    encounters: [
      { turn: 1, actorId: bob.actorId, islandId: alicePositiveUnrated.islandId, source: 'organic', selectionReason: 'cohortBoundaryProbe', focusTag: 'skill-based' },
      ...overlapIslandIds.map((islandId, index) => ({ turn: index + 2, actorId: bob.actorId, islandId, source: 'organic' as const, selectionReason: 'highValueScoutOpportunity' as const, focusTag: 'skill-based' })),
      { turn: 17, actorId: bob.actorId, islandId: postProxyIsland.islandId, source: 'organic', selectionReason: 'highValueScoutOpportunity', focusTag: 'skill-based' }
    ],
    expectedBehavior: [
      'Bob is made Alice-like by hidden archetype rewrite, not by forced visible vote outcomes.',
      'Bob autonomously rates the Alice-positive unrated island positive on turn 1.',
      'Alice has no ledger entry for the Alice-positive unrated island.',
      'After 15 matching overlap ratings, Bob earns lane-local Alice seedProxy authority.',
      'On the next turn, Bob’s earlier unrated-island rating is reprojected as seedProxy evidence without mutating ledger history.'
    ]
  };
}

export function proxyDiscoversSeedPositiveUnratedIslandFixture(): ModelingFixtureState {
  const base = goldenSeedProxyBaseline();
  const alice = base.actors.alice!;
  const bobLikeAlice = seedLikeActor('scenario-bob', 'Scenario Bob', alice, 0.98);
  return buildModelingFixtureFromScenario(base, [rewriteActorTruth('scenario-bob', bobLikeAlice)]).fixture;
}

export function scenarioSmokeFixture(): ModelingFixtureState {
  const base = goldenSeedProxyBaseline();
  const alice = base.actors.alice!;
  const almostBob = seedLikeActor('scenario-bob', 'Scenario Almost Bob', alice, 0.72, 'almostSeedLike');
  const disconnectedIsland = seedFitIsland('scenario-disconnected-control', 'Disconnected control island', alice, 0, 'disconnectedControl', ['cozy']);
  return buildModelingFixtureFromScenario(base, [
    rewriteActorTruth('scenario-bob', almostBob),
    rewriteIslandTruth(disconnectedIsland.islandId, disconnectedIsland),
    ensureEncounter({ turn: 18, actorId: almostBob.actorId, islandId: disconnectedIsland.islandId, source: 'organic', selectionReason: 'cohortBoundaryProbe', focusTag: 'cozy' })
  ]).fixture;
}

export function seedProxyScenarioMatrixFixture(): ModelingFixtureState {
  const alice = seedActor(
    'matrix-alice',
    'Matrix Alice',
    scenarioVector({ 'skill-based': 0.98, 'co-op': 0.18, 'fast-session': 0.08, 'brain-rot': -0.82, cozy: -0.18, social: 0.08 }),
    ['skill-based']
  );
  const bob = seedLikeActor('matrix-bob', 'Matrix Bob', alice, 1);
  const almostBob = seedLikeActor('matrix-almost-bob', 'Matrix Almost Bob', alice, 0.72, 'almostSeedLike');
  const antiBob = inverseSeedLikeActor('matrix-anti-bob', 'Matrix Anti-Bob', alice, 0.98);
  const control = disconnectedActor('matrix-control', 'Matrix Control');

  const bobUnrated = seedFitIsland('matrix-bob-unrated-positive', 'Bob-discovered Alice-positive unrated island', alice, 1, 'seedPositiveUnrated', ['skill-based']);
  const wrongLane = seedFitIsland('matrix-wrong-lane-brain-rot', 'Wrong-lane brain-rot control island', alice, 1, 'wrongLaneControl', ['brain-rot']);
  const disconnected = seedFitIsland('matrix-disconnected-island', 'Disconnected control island', alice, 0, 'disconnectedControl', ['cozy']);
  const postProxy = seedFitIsland('matrix-post-proxy-trigger', 'Post-proxy trigger island', alice, 1, 'overlapCalibration', ['skill-based']);
  const overlapIslandIds = Array.from({ length: 15 }, (_, index) => `matrix-overlap-${index + 1}`);
  const islands = Object.fromEntries([
    [bobUnrated.islandId, bobUnrated],
    [wrongLane.islandId, wrongLane],
    [disconnected.islandId, disconnected],
    [postProxy.islandId, postProxy],
    ...overlapIslandIds.map((id, index) => [id, seedFitIsland(id, `Matrix overlap island ${index + 1}`, alice, 1, 'overlapCalibration', ['skill-based'])] as const)
  ]);

  const bobOverlap = overlapIslandIds.map((islandId, index) => ({ turn: index + 3, actorId: bob.actorId, islandId, source: 'organic' as const, selectionReason: 'highValueScoutOpportunity' as const, focusTag: 'skill-based' }));
  const almostOverlap = overlapIslandIds.slice(0, 14).map((islandId, index) => ({ turn: index + 19, actorId: almostBob.actorId, islandId, source: 'organic' as const, selectionReason: 'highValueScoutOpportunity' as const, focusTag: 'skill-based' }));
  const antiOverlap = overlapIslandIds.map((islandId, index) => ({ turn: index + 34, actorId: antiBob.actorId, islandId, source: 'organic' as const, selectionReason: 'negativeAffinityConfirmation' as const, focusTag: 'skill-based' }));
  const controlOverlap = overlapIslandIds.map((islandId, index) => ({ turn: index + 50, actorId: control.actorId, islandId, source: 'organic' as const, selectionReason: 'cohortBoundaryProbe' as const, focusTag: 'skill-based' }));

  const definition: ScenarioDefinition = {
    id: 'seed-proxy-scenario-matrix',
    description: 'Scenario matrix: Bob, Almost Bob, Anti-Bob, and Control are generated from hidden truth, then evaluated from visible ledger/projection evidence only.',
    tags: DEFAULT_SCENARIO_TAGS.slice(),
    actors: {
      [alice.actorId]: alice,
      [bob.actorId]: bob,
      [almostBob.actorId]: almostBob,
      [antiBob.actorId]: antiBob,
      [control.actorId]: control
    },
    islands,
    seedRatingIslandIds: overlapIslandIds,
    encounters: [
      { turn: 1, actorId: bob.actorId, islandId: bobUnrated.islandId, source: 'organic', selectionReason: 'cohortBoundaryProbe', focusTag: 'skill-based' },
      { turn: 2, actorId: bob.actorId, islandId: wrongLane.islandId, source: 'organic', selectionReason: 'cohortBoundaryProbe', focusTag: 'brain-rot' },
      ...bobOverlap,
      { turn: 18, actorId: bob.actorId, islandId: postProxy.islandId, source: 'organic', selectionReason: 'highValueScoutOpportunity', focusTag: 'skill-based' },
      ...almostOverlap,
      ...antiOverlap,
      ...controlOverlap,
      { turn: 66, actorId: control.actorId, islandId: disconnected.islandId, source: 'organic', selectionReason: 'cohortBoundaryProbe', focusTag: 'cozy' }
    ],
    expectedBehavior: [
      'Hidden truth generates actor behavior and end-of-run checksums only; source-authority inference reads visible ledger/projection state only.',
      'Matrix Bob should become a skill-based Alice seedProxy and reproject his earlier Alice-positive unrated rating.',
      'Matrix Almost Bob is Alice-like but under overlap threshold and should remain ordinarySimilar, not seedProxy.',
      'Matrix Anti-Bob should infer as useful inverseSignal rather than seedProxy or bad/noisy evidence.',
      'Matrix Control should remain unrelated to Alice.',
      'Matrix Bob wrong-lane brain-rot evidence should not receive skill-based seedProxy projection.'
    ]
  };

  return buildModelingFixtureFromScenario(definition).fixture;
}

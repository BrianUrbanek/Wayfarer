import type {
  HiddenIslandTruth,
  HiddenPlayerTruth,
  IslandTasteModel,
  ModelingCoreState,
  ModelingFixtureOracle,
  ModelingFixtureState,
  PlayerPreferenceModel,
  PlayerSignalModel,
  RatingEvent,
  RatingEvidenceProjection,
  RatingLedgerEntry,
  TagId
} from './types.js';
import { proxyDiscoversSeedPositiveUnratedIslandFixture, seedProxyScenarioMatrixFixture } from './scenarioBuilder.js';

const ALL_TAGS: TagId[] = ['skill-based', 'co-op', 'fast-session', 'brain-rot', 'cozy', 'social'];

function vector(values: Partial<Record<TagId, number>>): Record<TagId, number> {
  return Object.fromEntries(ALL_TAGS.map((tag) => [tag, values[tag] ?? 0])) as Record<TagId, number>;
}


function makeSignalModel(
  laneSignalValues: Partial<Record<TagId, number>>,
  options: Partial<Omit<PlayerSignalModel, 'laneSignalByTag' | 'signalUsefulnessByTag' | 'signalAlignmentByTag' | 'signalRDByTag' | 'signalVolatilityByTag'>> & {
    signalAlignmentByTag?: Partial<Record<TagId, number>>;
    signalRDByTag?: Partial<Record<TagId, number>>;
    signalVolatilityByTag?: Partial<Record<TagId, number>>;
  } = {}
): PlayerSignalModel {
  const laneSignalByTag = vector(laneSignalValues);
  const trustRD = options.trustRD ?? 0.18;
  const signalVolatility = options.signalVolatility ?? 0.08;
  return {
    trustEstimate: options.trustEstimate ?? 0.82,
    trustRD,
    signalVolatility,
    sourceAuthority: options.sourceAuthority ?? 1,
    laneSignalByTag,
    signalUsefulnessByTag: { ...laneSignalByTag },
    signalAlignmentByTag: vector(options.signalAlignmentByTag ?? { 'skill-based': 0.8, 'co-op': 0.35, 'fast-session': 0.25, 'brain-rot': -0.55, cozy: 0.2, social: 0.3 }),
    signalRDByTag: vector(options.signalRDByTag ?? Object.fromEntries(ALL_TAGS.map((tag) => [tag, trustRD])) as Partial<Record<TagId, number>>),
    signalVolatilityByTag: vector(options.signalVolatilityByTag ?? Object.fromEntries(ALL_TAGS.map((tag) => [tag, signalVolatility])) as Partial<Record<TagId, number>>)
  };
}

function makePlayer(overrides: Partial<PlayerPreferenceModel> = {}): PlayerPreferenceModel {
  return {
    id: 'player-skill-scout',
    label: 'Skill scout',
    declaredAffinityByTag: vector({ 'skill-based': 0.9, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.6, cozy: -0.15, social: 0.15 }),
    demonstratedAffinityByTag: vector({ 'skill-based': 0.82, 'co-op': 0.25, 'fast-session': 0.05, 'brain-rot': -0.55, cozy: -0.1, social: 0.18 }),
    activeRoutingAffinityByTag: vector({ 'skill-based': 0.86, 'co-op': 0.22, 'fast-session': 0.08, 'brain-rot': -0.58, cozy: -0.12, social: 0.16 }),
    preferenceRDByTag: vector({ 'skill-based': 0.24, 'co-op': 0.42, 'fast-session': 0.55, 'brain-rot': 0.3, cozy: 0.48, social: 0.45 }),
    signalModel: makeSignalModel(
      { 'skill-based': 0.92, 'co-op': 0.55, 'fast-session': 0.35, 'brain-rot': 0.8, cozy: 0.4, social: 0.5 },
      { trustEstimate: 0.82, trustRD: 0.18, signalVolatility: 0.08, sourceAuthority: 1 }
    ),
    ...overrides
  };
}

function makeIsland(overrides: Partial<IslandTasteModel> = {}): IslandTasteModel {
  return {
    id: 'island-skill-arena',
    label: 'Skill Arena',
    descriptiveTagProfile: vector({ 'skill-based': 0.78, 'co-op': 0.1, 'fast-session': 0.2, 'brain-rot': -0.25, cozy: -0.2, social: 0.05 }),
    audienceFitByTag: vector({ 'skill-based': 0.56, 'co-op': 0.05, 'fast-session': 0.12, 'brain-rot': -0.38, cozy: -0.12, social: 0.02 }),
    audienceFitRDByTag: vector({ 'skill-based': 0.5, 'co-op': 0.65, 'fast-session': 0.7, 'brain-rot': 0.58, cozy: 0.66, social: 0.62 }),
    audienceFitVolatilityByTag: vector({ 'skill-based': 0.16, 'co-op': 0.22, 'fast-session': 0.2, 'brain-rot': 0.18, cozy: 0.2, social: 0.22 }),
    rawObservations: {
      positiveCount: 2,
      neutralCount: 0,
      negativeCount: 0
    },
    ...overrides
  };
}

function makeOracle(
  hiddenPlayers: Record<string, HiddenPlayerTruth>,
  hiddenIslands: Record<string, HiddenIslandTruth>,
  expectedBehavior: string[]
): ModelingFixtureOracle {
  return { hiddenPlayers, hiddenIslands, expectedBehavior };
}

function makeState(players: PlayerPreferenceModel[], islands: IslandTasteModel[]): ModelingCoreState {
  return {
    allTags: ALL_TAGS.slice(),
    players,
    islands,
    ratingEvents: [],
    ratingLedger: [],
    evidenceProjections: [],
    dirtyProjections: []
  };
}

function buildFixtureState(
  fixtureId: string,
  ratingEvents: RatingEvent[],
  description: string,
  state: ModelingCoreState,
  oracle: ModelingFixtureOracle
): ModelingFixtureState {
  return {
    initialState: state,
    ratingEvents,
    description: `${fixtureId}: ${description}`,
    oracle
  };
}

function event(id: string, rating: -1 | 0 | 1, overrides: Partial<RatingEvent> = {}): RatingEvent {
  return {
    id,
    turn: 1,
    userId: 'player-skill-scout',
    islandId: 'island-skill-arena',
    rating,
    source: 'guided',
    focusTag: 'skill-based',
    focusMeaning: 'expectationFulfillment',
    selectionReason: 'highValueScoutOpportunity',
    ...overrides
  };
}

const skillScoutTruth = (): HiddenPlayerTruth => ({
  preferenceByTag: vector({ 'skill-based': 0.9, 'co-op': 0.25, 'fast-session': 0.1, 'brain-rot': -0.7, cozy: -0.15, social: 0.15 }),
  notes: 'Hidden oracle: the player genuinely seeks skill-based islands and rejects brain-rot.'
});

const skillArenaTruth = (): HiddenIslandTruth => ({
  descriptiveTagProfile: vector({ 'skill-based': 0.85, 'co-op': 0.1, 'fast-session': 0.2, 'brain-rot': -0.2, cozy: -0.2, social: 0.05 }),
  audienceFitByTag: vector({ 'skill-based': 0.75, 'co-op': 0.05, 'fast-session': 0.15, 'brain-rot': -0.45, cozy: -0.1, social: 0.03 }),
  notes: 'Hidden oracle: this island really is a solid skill-based fit.'
});

function uniformVector(value: number): Record<TagId, number> {
  return vector(Object.fromEntries(ALL_TAGS.map((tag) => [tag, value])) as Record<TagId, number>);
}

function pressurePlayer(playerRD: number, trustEstimate = 0.82): PlayerPreferenceModel {
  return makePlayer({
    id: 'player-pressure-test',
    label: 'Pressure Test Player',
    declaredAffinityByTag: uniformVector(0.82),
    demonstratedAffinityByTag: uniformVector(0.82),
    activeRoutingAffinityByTag: uniformVector(0.82),
    preferenceRDByTag: uniformVector(playerRD),
    signalModel: makeSignalModel(
      Object.fromEntries(ALL_TAGS.map((tag) => [tag, 0.9])) as Partial<Record<TagId, number>>,
      {
        trustEstimate,
        trustRD: 0.18,
        signalVolatility: 0.08,
        sourceAuthority: 1,
        signalAlignmentByTag: Object.fromEntries(ALL_TAGS.map((tag) => [tag, 0.75])) as Partial<Record<TagId, number>>
      }
    )
  });
}

function pressureIsland(islandRD: number, audienceFit = 0.45): IslandTasteModel {
  return makeIsland({
    id: 'island-pressure-test',
    label: 'Pressure Test Island',
    descriptiveTagProfile: uniformVector(audienceFit),
    audienceFitByTag: uniformVector(audienceFit),
    audienceFitRDByTag: uniformVector(islandRD),
    audienceFitVolatilityByTag: uniformVector(0.12),
    rawObservations: { positiveCount: 5, neutralCount: 0, negativeCount: 0 }
  });
}

function pressureFixture(
  fixtureId: string,
  playerRD: number,
  islandRD: number,
  rating: -1 | 1,
  audienceFit: number,
  trustEstimate: number,
  expectedBehavior: string[]
): ModelingFixtureState {
  const player = pressurePlayer(playerRD, trustEstimate);
  const island = pressureIsland(islandRD, audienceFit);
  return buildFixtureState(
    fixtureId,
    [event(`${fixtureId}:event-0`, rating, {
      userId: player.id,
      islandId: island.id,
      focusTag: undefined,
      focusMeaning: undefined,
      selectionReason: 'cohortBoundaryProbe'
    })],
    `pressure test: playerRD=${playerRD}, islandRD=${islandRD}, rating=${rating}, audienceFit=${audienceFit}, trust=${trustEstimate}`,
    makeState([player], [island]),
    makeOracle(
      { [player.id]: { preferenceByTag: uniformVector(0.82), notes: 'Hidden oracle: uniform positive player for monotonic pressure testing.' } },
      { [island.id]: { audienceFitByTag: uniformVector(audienceFit), notes: 'Hidden oracle: uniform island for monotonic pressure testing.' } },
      expectedBehavior
    )
  );
}


function routingSignalModel(usefulness: number, rd: number, volatility: number, alignment = 0.8): PlayerSignalModel {
  return makeSignalModel(
    Object.fromEntries(ALL_TAGS.map((tag) => [tag, usefulness])) as Partial<Record<TagId, number>>,
    {
      trustEstimate: usefulness,
      trustRD: rd,
      signalVolatility: volatility,
      sourceAuthority: 1,
      signalAlignmentByTag: Object.fromEntries(ALL_TAGS.map((tag) => [tag, alignment])) as Partial<Record<TagId, number>>,
      signalRDByTag: Object.fromEntries(ALL_TAGS.map((tag) => [tag, rd])) as Partial<Record<TagId, number>>,
      signalVolatilityByTag: Object.fromEntries(ALL_TAGS.map((tag) => [tag, volatility])) as Partial<Record<TagId, number>>
    }
  );
}

function routingPlayer(options: {
  id: string;
  demonstratedAffinity: number;
  declaredAffinity?: number;
  playerRD: number;
  signalUsefulness?: number;
  signalRD?: number;
  signalVolatility?: number;
}): PlayerPreferenceModel {
  const declared = options.declaredAffinity ?? options.demonstratedAffinity;
  return makePlayer({
    id: options.id,
    label: options.id,
    declaredAffinityByTag: uniformVector(declared),
    demonstratedAffinityByTag: uniformVector(options.demonstratedAffinity),
    activeRoutingAffinityByTag: uniformVector((declared + options.demonstratedAffinity) / 2),
    preferenceRDByTag: uniformVector(options.playerRD),
    signalModel: routingSignalModel(options.signalUsefulness ?? 0.65, options.signalRD ?? 0.35, options.signalVolatility ?? 0.12)
  });
}

function routingIsland(options: {
  id: string;
  audienceFit: number;
  islandRD: number;
  volatility: number;
}): IslandTasteModel {
  return makeIsland({
    id: options.id,
    label: options.id,
    descriptiveTagProfile: uniformVector(options.audienceFit),
    audienceFitByTag: uniformVector(options.audienceFit),
    audienceFitRDByTag: uniformVector(options.islandRD),
    audienceFitVolatilityByTag: uniformVector(options.volatility),
    rawObservations: { positiveCount: 4, neutralCount: 0, negativeCount: 0 }
  });
}

function routingFixture(
  fixtureId: string,
  player: PlayerPreferenceModel,
  island: IslandTasteModel,
  expectedBehavior: string[]
): ModelingFixtureState {
  return buildFixtureState(
    fixtureId,
    [event(`${fixtureId}:event-0`, 1, {
      userId: player.id,
      islandId: island.id,
      focusTag: undefined,
      focusMeaning: undefined,
      selectionReason: 'highValueScoutOpportunity'
    })],
    `routing policy pressure test: ${fixtureId}`,
    makeState([player], [island]),
    makeOracle(
      { [player.id]: { preferenceByTag: { ...player.demonstratedAffinityByTag }, notes: 'Hidden oracle: routing pressure-test player.' } },
      { [island.id]: { audienceFitByTag: { ...island.audienceFitByTag }, notes: 'Hidden oracle: routing pressure-test island.' } },
      expectedBehavior
    )
  );
}


function proxyIsland(id: string): IslandTasteModel {
  return makeIsland({
    id,
    label: id,
    descriptiveTagProfile: vector({ 'skill-based': 0.8, 'co-op': 0.1, 'fast-session': 0.15, 'brain-rot': -0.2, cozy: -0.1, social: 0.05 }),
    audienceFitByTag: vector({ 'skill-based': 0.72, 'co-op': 0.08, 'fast-session': 0.12, 'brain-rot': -0.22, cozy: -0.08, social: 0.04 }),
    audienceFitRDByTag: uniformVector(0.74),
    audienceFitVolatilityByTag: uniformVector(0.12),
    rawObservations: { positiveCount: 0, neutralCount: 0, negativeCount: 0 }
  });
}

function seedLedgerEntry(eventId: string, seedPlayerId: string, islandId: string, turn: number): RatingLedgerEntry {
  return {
    entryId: `${eventId}:ledger`,
    eventId,
    playerId: seedPlayerId,
    islandId,
    rating: 1,
    focusTag: 'skill-based',
    focusMeaning: 'expectationFulfillment',
    source: 'organic',
    selectionReason: 'highValueScoutOpportunity',
    turn,
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
    polarity: 1,
    trainingEligible: true,
    eventTurn: entry.turn,
    readModelStateTurn: Math.max(0, entry.turn - 1),
    projectedTurn: entry.turn,
    calculatedAtTurn: entry.turn,
    modelVersion: 'modeling-core-v11c-seed-fixture'
  };
}

function bobBecomesAliceProxyFixture(): ModelingFixtureState {
  const alice = makePlayer({
    id: 'seed-alice',
    label: 'Seed Alice',
    declaredAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    demonstratedAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    activeRoutingAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    preferenceRDByTag: uniformVector(0.06),
    signalModel: makeSignalModel(
      { 'skill-based': 0.98, 'co-op': 0.4, 'fast-session': 0.3, 'brain-rot': 0.9, cozy: 0.25, social: 0.3 },
      {
        trustEstimate: 0.98,
        trustRD: 0.04,
        signalVolatility: 0.03,
        sourceAuthority: 1.45,
        signalAlignmentByTag: { 'skill-based': 0.95, 'co-op': 0.3, 'fast-session': 0.2, 'brain-rot': -0.8, cozy: 0.1, social: 0.15 },
        signalRDByTag: { 'skill-based': 0.04 },
        signalVolatilityByTag: { 'skill-based': 0.03 }
      }
    )
  });
  const bob = makePlayer({
    id: 'new-bob',
    label: 'New Bob',
    declaredAffinityByTag: vector({ 'skill-based': 0.8, 'co-op': 0.15, 'fast-session': 0.1, 'brain-rot': -0.4, cozy: -0.1, social: 0.05 }),
    demonstratedAffinityByTag: vector({ 'skill-based': 0.5, 'co-op': 0.1, 'fast-session': 0.05, 'brain-rot': -0.1, cozy: 0, social: 0 }),
    activeRoutingAffinityByTag: vector({ 'skill-based': 0.7, 'co-op': 0.12, 'fast-session': 0.08, 'brain-rot': -0.25, cozy: -0.05, social: 0.02 }),
    preferenceRDByTag: uniformVector(0.82),
    signalModel: makeSignalModel(
      { 'skill-based': 0.14, 'co-op': 0.14, 'fast-session': 0.14, 'brain-rot': 0.14, cozy: 0.14, social: 0.14 },
      {
        trustEstimate: 0.14,
        trustRD: 0.86,
        signalVolatility: 0.18,
        sourceAuthority: 1,
        signalAlignmentByTag: { 'skill-based': 0.1 },
        signalRDByTag: { 'skill-based': 0.86 },
        signalVolatilityByTag: { 'skill-based': 0.18 }
      }
    )
  });

  const bobOnlyIds = Array.from({ length: 5 }, (_, index) => `bob-only-island-${index + 1}`);
  const overlapIds = Array.from({ length: 15 }, (_, index) => `alice-overlap-island-${index + 1}`);
  const postProxyIds = ['post-proxy-island'];
  const islands = [...bobOnlyIds, ...overlapIds, ...postProxyIds].map(proxyIsland);
  const seedEntries = overlapIds.map((islandId, index) => seedLedgerEntry(`alice-seed:event-${index + 1}`, alice.id, islandId, 1));
  const seedEvents: RatingEvent[] = overlapIds.map((islandId, index) => ({
    id: `alice-seed:event-${index + 1}`,
    turn: 1,
    userId: alice.id,
    islandId,
    rating: 1,
    source: 'organic',
    focusTag: 'skill-based',
    focusMeaning: 'expectationFulfillment',
    selectionReason: 'highValueScoutOpportunity'
  }));
  const bobEvents: RatingEvent[] = [...bobOnlyIds, ...overlapIds, ...postProxyIds].map((islandId, index) => ({
    id: `bob-proxy:event-${index + 1}`,
    turn: index + 1,
    userId: bob.id,
    islandId,
    rating: 1,
    source: 'organic',
    focusTag: 'skill-based',
    focusMeaning: 'expectationFulfillment',
    selectionReason: index < 5 ? 'cohortBoundaryProbe' : 'highValueScoutOpportunity'
  }));

  const state = makeState([alice, bob], islands);
  state.ratingEvents = seedEvents;
  state.ratingLedger = seedEntries;
  state.evidenceProjections = seedEntries.map(seedProjection);

  return buildFixtureState(
    'bob-becomes-alice-proxy',
    bobEvents,
    'Bob starts untrusted, matches seed Alice across 15 overlap ratings, then his prior Bob-only ratings are reprojected as Alice-proxy evidence',
    state,
    makeOracle(
      {
        [alice.id]: { preferenceByTag: vector({ 'skill-based': 0.98 }), notes: 'Hidden oracle: Alice is a cohort seed / trust root.' },
        [bob.id]: { preferenceByTag: vector({ 'skill-based': 0.92 }), notes: 'Hidden oracle: Bob is Alice-like but starts with no authority.' }
      },
      Object.fromEntries(islands.map((island) => [island.id, { audienceFitByTag: { ...island.audienceFitByTag }, notes: 'Hidden oracle: proxy fixture island.' }])),
      [
        'Bob should remain ordinary evidence until seed overlap establishes proxy authority.',
        'After 15/15 Alice-overlap matches, Bob should become a silent seedProxy for Alice in skill-based.',
        'Bob-only earlier ratings should be marked for later reprojection when proxy authority becomes readable next turn.',
        'The post-proxy turn should reproject Bob-only earlier ratings as Alice-proxy evidence without mutating ledger history.'
      ]
    )
  );

}

interface SeedProxyControlOptions {
  fixtureId: string;
  overlapCount: number;
  contradictionIndex?: number;
  includeWrongLaneBobOnly?: boolean;
  description: string;
  expectedBehavior: string[];
}

function seedProxyControlFixture(options: SeedProxyControlOptions): ModelingFixtureState {
  const alice = makePlayer({
    id: `${options.fixtureId}:seed-alice`,
    label: 'Seed Alice',
    declaredAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    demonstratedAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    activeRoutingAffinityByTag: vector({ 'skill-based': 0.96, 'co-op': 0.2, 'fast-session': 0.1, 'brain-rot': -0.8, cozy: -0.2, social: 0.1 }),
    preferenceRDByTag: uniformVector(0.06),
    signalModel: makeSignalModel(
      { 'skill-based': 0.98, 'co-op': 0.4, 'fast-session': 0.3, 'brain-rot': 0.9, cozy: 0.25, social: 0.3 },
      {
        trustEstimate: 0.98,
        trustRD: 0.04,
        signalVolatility: 0.03,
        sourceAuthority: 1.45,
        signalAlignmentByTag: { 'skill-based': 0.95 },
        signalRDByTag: { 'skill-based': 0.04 },
        signalVolatilityByTag: { 'skill-based': 0.03 }
      }
    )
  });
  const bob = makePlayer({
    id: `${options.fixtureId}:new-bob`,
    label: 'New Bob',
    declaredAffinityByTag: vector({ 'skill-based': 0.8, 'co-op': 0.15, 'fast-session': 0.1, 'brain-rot': -0.4, cozy: -0.1, social: 0.05 }),
    demonstratedAffinityByTag: vector({ 'skill-based': 0.5, 'co-op': 0.1, 'fast-session': 0.05, 'brain-rot': -0.1, cozy: 0, social: 0 }),
    activeRoutingAffinityByTag: vector({ 'skill-based': 0.7, 'co-op': 0.12, 'fast-session': 0.08, 'brain-rot': -0.25, cozy: -0.05, social: 0.02 }),
    preferenceRDByTag: uniformVector(0.82),
    signalModel: makeSignalModel(
      { 'skill-based': 0.14, 'co-op': 0.14, 'fast-session': 0.14, 'brain-rot': 0.14, cozy: 0.14, social: 0.14 },
      {
        trustEstimate: 0.14,
        trustRD: 0.86,
        signalVolatility: 0.18,
        sourceAuthority: 1,
        signalAlignmentByTag: { 'skill-based': 0.1, cozy: 0.1 },
        signalRDByTag: { 'skill-based': 0.86, cozy: 0.86 },
        signalVolatilityByTag: { 'skill-based': 0.18, cozy: 0.18 }
      }
    )
  });
  const bobOnlyIds = Array.from({ length: 5 }, (_, index) => `${options.fixtureId}:bob-only-island-${index + 1}`);
  const overlapIds = Array.from({ length: options.overlapCount }, (_, index) => `${options.fixtureId}:alice-overlap-island-${index + 1}`);
  const postProxyIds = [`${options.fixtureId}:post-proxy-island`];
  const islands = [...bobOnlyIds, ...overlapIds, ...postProxyIds].map(proxyIsland);
  const seedEntries = overlapIds.map((islandId, index) => seedLedgerEntry(`${options.fixtureId}:alice-seed:event-${index + 1}`, alice.id, islandId, 1));
  const seedEvents: RatingEvent[] = overlapIds.map((islandId, index) => ({
    id: `${options.fixtureId}:alice-seed:event-${index + 1}`,
    turn: 1,
    userId: alice.id,
    islandId,
    rating: 1,
    source: 'organic',
    focusTag: 'skill-based',
    focusMeaning: 'expectationFulfillment',
    selectionReason: 'highValueScoutOpportunity'
  }));
  const bobEvents: RatingEvent[] = [...bobOnlyIds, ...overlapIds, ...postProxyIds].map((islandId, index) => {
    const isBobOnly = index < bobOnlyIds.length;
    const isWrongLaneBobOnly = options.includeWrongLaneBobOnly && index === 0;
    const overlapIndex = index - bobOnlyIds.length;
    return {
      id: `${options.fixtureId}:bob-proxy:event-${index + 1}`,
      turn: index + 1,
      userId: bob.id,
      islandId,
      rating: options.contradictionIndex === overlapIndex ? -1 : 1,
      source: 'organic',
      focusTag: isWrongLaneBobOnly ? 'cozy' : 'skill-based',
      focusMeaning: 'expectationFulfillment',
      selectionReason: isBobOnly ? 'cohortBoundaryProbe' : 'highValueScoutOpportunity'
    };
  });

  const state = makeState([alice, bob], islands);
  state.ratingEvents = seedEvents;
  state.ratingLedger = seedEntries;
  state.evidenceProjections = seedEntries.map(seedProjection);

  return buildFixtureState(
    options.fixtureId,
    bobEvents,
    options.description,
    state,
    makeOracle(
      {
        [alice.id]: { preferenceByTag: vector({ 'skill-based': 0.98 }), notes: 'Hidden oracle: Alice is a cohort seed / trust root.' },
        [bob.id]: { preferenceByTag: vector({ 'skill-based': 0.92 }), notes: 'Hidden oracle: Bob is Alice-like unless the fixture deliberately withholds/contradicts enough overlap.' }
      },
      Object.fromEntries(islands.map((island) => [island.id, { audienceFitByTag: { ...island.audienceFitByTag }, notes: 'Hidden oracle: proxy control fixture island.' }])),
      options.expectedBehavior
    )
  );
}

export function listModelingFixtureIds(): string[] {
  return [
    'basic',
    'aligned-positive',
    'meh-observed',
    'focused-negative',
    'stable-negative-affinity',
    'confident-island-vs-uncertain-player',
    'uncertain-island-vs-confident-player',
    'both-confident-contradiction',
    'pressure-player-rd-low',
    'pressure-player-rd-high',
    'pressure-island-rd-low',
    'pressure-island-rd-high',
    'pressure-surprise-mild',
    'pressure-surprise-extreme',
    'pressure-signal-low',
    'pressure-signal-high',
    'declared-vs-demonstrated-mismatch',
    'routing-safe-fit',
    'routing-smart-gamble',
    'routing-discovery-probe',
    'routing-avoid-negative',
    'routing-volatile-positive',
    'routing-guided-mismatch',
    'rating-revision-supersedes',
    'bob-becomes-alice-proxy',
    'seed-proxy-insufficient-overlap',
    'seed-proxy-contradiction-control',
    'seed-proxy-lane-local-control',
    'proxy-discovers-seed-positive-unrated-island',
    'seed-proxy-scenario-matrix'
  ];
}

export function loadModelingFixture(fixtureId: string): ModelingFixtureState {
  switch (fixtureId) {
    case 'seed-proxy-scenario-matrix':
      return seedProxyScenarioMatrixFixture();
    case 'proxy-discovers-seed-positive-unrated-island':
      return proxyDiscoversSeedPositiveUnratedIslandFixture();
    case 'bob-becomes-alice-proxy':
      return bobBecomesAliceProxyFixture();
    case 'seed-proxy-insufficient-overlap':
      return seedProxyControlFixture({
        fixtureId: 'seed-proxy-insufficient-overlap',
        overlapCount: 14,
        description: 'Control: Bob matches Alice but with insufficient overlap to earn seed-proxy authority',
        expectedBehavior: [
          'Bob should not become a seedProxy before the minimum overlap threshold is met.',
          'Bob-only ratings should remain ordinary evidence.'
        ]
      });
    case 'seed-proxy-contradiction-control':
      return seedProxyControlFixture({
        fixtureId: 'seed-proxy-contradiction-control',
        overlapCount: 16,
        contradictionIndex: 0,
        description: 'Control: Bob has enough overlap but one contradiction prevents exact seed-proxy promotion',
        expectedBehavior: [
          'Bob should not become a seedProxy when the overlap includes contradictions.',
          'Contradictory overlap should block the exact-match proxy happy path.'
        ]
      });
    case 'seed-proxy-lane-local-control':
      return seedProxyControlFixture({
        fixtureId: 'seed-proxy-lane-local-control',
        overlapCount: 15,
        includeWrongLaneBobOnly: true,
        description: 'Control: Bob earns skill-based seed-proxy authority, but wrong-lane Bob-only ratings remain ordinary evidence',
        expectedBehavior: [
          'Bob should become a skill-based seedProxy after sufficient skill-based overlap.',
          'A prior cozy-focused rating should not be reprojected as skill-based Alice-proxy evidence.'
        ]
      });
    case 'meh-observed':
      return buildFixtureState(
        'meh-observed',
        [event('fixture-1:event-0', 0, { source: 'organic', selectionReason: 'declaredPreferenceFit' })],
        'neutral response is stored but does not train preference/audience fit',
        makeState([makePlayer()], [makeIsland()]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['Store neutral exposure evidence.', 'Do not move audience fit, demonstrated affinity, RD, or volatility.']
        )
      );
    case 'focused-negative':
      return buildFixtureState(
        'focused-negative',
        [event('fixture-2:event-0', -1, { selectionReason: 'declaredObservedMismatchProbe' })],
        'negative focused vote means the island failed the skill-based promise, not that the player dislikes skill-based',
        makeState([makePlayer()], [makeIsland()]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          {
            'island-skill-arena': {
              ...skillArenaTruth(),
              notes: 'Hidden oracle for this fixture: pretend the visible island promise may be wrong; negative focused evidence should mostly hit island fulfillment.'
            }
          },
          ['Focused negative evidence should move island skill-based audience fit down.', 'Player skill-based affinity should move only lightly.']
        )
      );
    case 'stable-negative-affinity': {
      const player = makePlayer({
        id: 'player-anti-brain-rot',
        label: 'Anti brain-rot scout',
        declaredAffinityByTag: vector({ 'skill-based': 0.35, 'co-op': 0.1, 'fast-session': 0.1, 'brain-rot': -0.9, cozy: 0.05, social: 0.1 }),
        demonstratedAffinityByTag: vector({ 'skill-based': 0.3, 'co-op': 0.05, 'fast-session': 0.05, 'brain-rot': -0.86, cozy: 0.02, social: 0.1 }),
        activeRoutingAffinityByTag: vector({ 'skill-based': 0.32, 'co-op': 0.08, 'fast-session': 0.08, 'brain-rot': -0.88, cozy: 0.04, social: 0.1 }),
        preferenceRDByTag: vector({ 'skill-based': 0.32, 'co-op': 0.5, 'fast-session': 0.52, 'brain-rot': 0.18, cozy: 0.55, social: 0.5 }),
        signalModel: makeSignalModel(
          { 'skill-based': 0.5, 'co-op': 0.35, 'fast-session': 0.35, 'brain-rot': 0.92, cozy: 0.25, social: 0.3 },
          {
            trustEstimate: 0.8,
            trustRD: 0.16,
            signalVolatility: 0.08,
            sourceAuthority: 1,
            signalAlignmentByTag: { 'skill-based': 0.25, 'co-op': 0.1, 'fast-session': 0.1, 'brain-rot': -0.72, cozy: 0.05, social: 0.1 }
          }
        )
      });
      const island = makeIsland({
        id: 'island-brain-rot-chaos',
        label: 'Brain Rot Chaos',
        descriptiveTagProfile: vector({ 'skill-based': -0.25, 'co-op': 0.05, 'fast-session': 0.35, 'brain-rot': 0.88, cozy: -0.35, social: 0.1 }),
        audienceFitByTag: vector({ 'skill-based': -0.32, 'co-op': 0.05, 'fast-session': 0.28, 'brain-rot': 0.68, cozy: -0.28, social: 0.05 }),
        audienceFitRDByTag: vector({ 'skill-based': 0.5, 'co-op': 0.62, 'fast-session': 0.52, 'brain-rot': 0.44, cozy: 0.58, social: 0.62 }),
        audienceFitVolatilityByTag: vector({ 'skill-based': 0.2, 'co-op': 0.2, 'fast-session': 0.24, 'brain-rot': 0.15, cozy: 0.2, social: 0.22 })
      });
      return buildFixtureState(
        'stable-negative-affinity',
        [event('fixture-3:event-0', -1, { userId: player.id, islandId: island.id, focusTag: 'brain-rot', selectionReason: 'negativeAffinityConfirmation' })],
        'a stable anti-brain-rot player downvoting a brain-rot island is useful confirmation, not adversarial noise',
        makeState([player], [island]),
        makeOracle(
          { [player.id]: { preferenceByTag: vector({ 'brain-rot': -0.95, 'skill-based': 0.35 }), notes: 'Hidden oracle: stable inverse preference against brain-rot.' } },
          { [island.id]: { audienceFitByTag: vector({ 'brain-rot': 0.8 }), notes: 'Hidden oracle: this really is for brain-rot-positive players.' } },
          ['Downvote should make player brain-rot affinity more negative.', 'Downvote from inverse-affinity player should increase island brain-rot audience fit.']
        )
      );
    }
    case 'confident-island-vs-uncertain-player':
      return buildFixtureState(
        'confident-island-vs-uncertain-player',
        [event('fixture-4:event-0', 1, { focusTag: undefined, focusMeaning: undefined, selectionReason: 'observedAffinityFit' })],
        'when island fit is confident and player preference is uncertain, player demonstrated affinity should move more than island fit',
        makeState([
          makePlayer({
            preferenceRDByTag: vector({ 'skill-based': 0.86, 'co-op': 0.8, 'fast-session': 0.8, 'brain-rot': 0.8, cozy: 0.8, social: 0.8 })
          })
        ], [
          makeIsland({
            audienceFitRDByTag: vector({ 'skill-based': 0.12, 'co-op': 0.14, 'fast-session': 0.16, 'brain-rot': 0.16, cozy: 0.15, social: 0.16 })
          })
        ]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['Player uncertainty is high; update pressure should allocate mostly to player demonstrated affinity.']
        )
      );
    case 'uncertain-island-vs-confident-player':
      return buildFixtureState(
        'uncertain-island-vs-confident-player',
        [event('fixture-5:event-0', 1, { focusTag: undefined, focusMeaning: undefined, selectionReason: 'highValueScoutOpportunity' })],
        'when trusted player preference is confident and island fit is uncertain, island audience fit should move more than player affinity',
        makeState([
          makePlayer({
            preferenceRDByTag: vector({ 'skill-based': 0.12, 'co-op': 0.14, 'fast-session': 0.14, 'brain-rot': 0.16, cozy: 0.14, social: 0.14 })
          })
        ], [
          makeIsland({
            audienceFitRDByTag: vector({ 'skill-based': 0.86, 'co-op': 0.8, 'fast-session': 0.82, 'brain-rot': 0.84, cozy: 0.82, social: 0.8 })
          })
        ]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['Island uncertainty is high; update pressure should allocate mostly to island audience fit.']
        )
      );
    case 'both-confident-contradiction':
      return buildFixtureState(
        'both-confident-contradiction',
        [event('fixture-6:event-0', -1, { selectionReason: 'cohortBoundaryProbe' })],
        'confident player contradicts confident island fit; record surprise and volatility rather than blindly trusting one side',
        makeState([
          makePlayer({ preferenceRDByTag: vector({ 'skill-based': 0.12, 'co-op': 0.14, 'fast-session': 0.14, 'brain-rot': 0.14, cozy: 0.14, social: 0.14 }) })
        ], [
          makeIsland({ audienceFitRDByTag: vector({ 'skill-based': 0.12, 'co-op': 0.14, 'fast-session': 0.14, 'brain-rot': 0.14, cozy: 0.14, social: 0.14 }) })
        ]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['Both sides are confident; volatility should rise on focused contradiction.']
        )
      );

    case 'pressure-player-rd-low':
      return pressureFixture(
        'pressure-player-rd-low',
        0.18,
        0.45,
        1,
        0.45,
        0.82,
        ['Low player RD should allocate less movement to player than the high-player-RD variant.']
      );
    case 'pressure-player-rd-high':
      return pressureFixture(
        'pressure-player-rd-high',
        0.82,
        0.45,
        1,
        0.45,
        0.82,
        ['High player RD should allocate more movement to player than the low-player-RD variant.']
      );
    case 'pressure-island-rd-low':
      return pressureFixture(
        'pressure-island-rd-low',
        0.45,
        0.18,
        1,
        0.45,
        0.82,
        ['Low island RD should allocate less movement to island than the high-island-RD variant.']
      );
    case 'pressure-island-rd-high':
      return pressureFixture(
        'pressure-island-rd-high',
        0.45,
        0.82,
        1,
        0.45,
        0.82,
        ['High island RD should allocate more movement to island than the low-island-RD variant.']
      );
    case 'pressure-surprise-mild':
      return pressureFixture(
        'pressure-surprise-mild',
        0.12,
        0.12,
        -1,
        -0.3,
        0.82,
        ['Mild surprise should produce lower confidenceConflict and less volatility pressure than the extreme surprise variant.']
      );
    case 'pressure-surprise-extreme':
      return pressureFixture(
        'pressure-surprise-extreme',
        0.12,
        0.12,
        -1,
        0.45,
        0.82,
        ['Extreme surprise should produce higher confidenceConflict and more volatility pressure than the mild surprise variant.']
      );
    case 'pressure-signal-low':
      return pressureFixture(
        'pressure-signal-low',
        0.12,
        0.12,
        -1,
        0.45,
        0.25,
        ['Low signal strength should produce less update magnitude and volatility pressure than the high-signal variant.']
      );
    case 'pressure-signal-high':
      return pressureFixture(
        'pressure-signal-high',
        0.12,
        0.12,
        -1,
        0.45,
        0.88,
        ['High signal strength should produce more update magnitude and volatility pressure than the low-signal variant.']
      );

    case 'routing-safe-fit':
      return routingFixture(
        'routing-safe-fit',
        routingPlayer({ id: 'routing-safe-player', demonstratedAffinity: 0.92, playerRD: 0.08, signalUsefulness: 0.45, signalRD: 0.5, signalVolatility: 0.2 }),
        routingIsland({ id: 'routing-safe-island', audienceFit: 0.9, islandRD: 0.08, volatility: 0.05 }),
        ['High predicted fit plus high confidence and low volatility should classify as SAFE_FIT.']
      );
    case 'routing-smart-gamble':
      return routingFixture(
        'routing-smart-gamble',
        routingPlayer({ id: 'routing-gamble-player', demonstratedAffinity: 0.88, playerRD: 0.42, signalUsefulness: 0.15, signalRD: 0.7, signalVolatility: 0.3 }),
        routingIsland({ id: 'routing-gamble-island', audienceFit: 0.82, islandRD: 0.42, volatility: 0.12 }),
        ['Positive predicted fit with moderate uncertainty should classify as SMART_GAMBLE rather than SAFE_FIT.']
      );
    case 'routing-discovery-probe':
      return routingFixture(
        'routing-discovery-probe',
        routingPlayer({ id: 'routing-probe-player', demonstratedAffinity: 0.12, playerRD: 0.72, signalUsefulness: 0.95, signalRD: 0.12, signalVolatility: 0.06 }),
        routingIsland({ id: 'routing-probe-island', audienceFit: 0.12, islandRD: 0.84, volatility: 0.16 }),
        ['Low certainty, near-neutral predicted fit, and high scout value should classify as DISCOVERY_PROBE.']
      );
    case 'routing-avoid-negative':
      return routingFixture(
        'routing-avoid-negative',
        routingPlayer({ id: 'routing-avoid-player', demonstratedAffinity: 0.88, playerRD: 0.08, signalUsefulness: 0.35, signalRD: 0.5, signalVolatility: 0.2 }),
        routingIsland({ id: 'routing-avoid-island', audienceFit: -0.88, islandRD: 0.08, volatility: 0.05 }),
        ['Confident negative predicted fit should classify as SUPPRESS_OR_AVOID.']
      );
    case 'routing-volatile-positive':
      return routingFixture(
        'routing-volatile-positive',
        routingPlayer({ id: 'routing-volatile-player', demonstratedAffinity: 0.88, playerRD: 0.12, signalUsefulness: 0.55, signalRD: 0.35, signalVolatility: 0.18 }),
        routingIsland({ id: 'routing-volatile-island', audienceFit: 0.82, islandRD: 0.12, volatility: 0.85 }),
        ['Positive but volatile fit should not classify as SAFE_FIT.']
      );

    case 'rating-revision-supersedes':
      return buildFixtureState(
        'rating-revision-supersedes',
        [
          event('rating-revision:event-0', 1, { source: 'organic', selectionReason: 'declaredPreferenceFit' }),
          event('rating-revision:event-1', -1, {
            turn: 2,
            source: 'organic',
            selectionReason: 'declaredPreferenceFit',
            revisionReason: 'playerChangedMind',
            supersedesEventId: 'rating-revision:event-0'
          })
        ],
        'rating history is append-only while active rating state can be superseded',
        makeState([makePlayer()], [makeIsland()]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['The first ledger entry remains auditable.', 'The superseded first projection no longer contributes to current island estimate.']
        )
      );
    case 'routing-guided-mismatch':
      return routingFixture(
        'routing-guided-mismatch',
        routingPlayer({ id: 'routing-mismatch-player', demonstratedAffinity: -0.45, declaredAffinity: 0.9, playerRD: 0.22, signalUsefulness: 0.7, signalRD: 0.25, signalVolatility: 0.12 }),
        routingIsland({ id: 'routing-mismatch-island', audienceFit: 0.85, islandRD: 0.3, volatility: 0.16 }),
        ['Large declared-vs-demonstrated mismatch should classify as GUIDED_DISCOVERY.']
      );
    case 'declared-vs-demonstrated-mismatch': {
      const player = makePlayer({
        id: 'player-declared-skill-hidden-cozy',
        label: 'Declared skill, hidden cozy/social',
        declaredAffinityByTag: vector({ 'skill-based': 0.9, 'co-op': 0.15, 'fast-session': 0.05, 'brain-rot': -0.4, cozy: 0.05, social: 0.1 }),
        demonstratedAffinityByTag: vector({ 'skill-based': 0.35, 'co-op': 0.1, 'fast-session': 0.05, 'brain-rot': -0.15, cozy: 0.25, social: 0.22 }),
        activeRoutingAffinityByTag: vector({ 'skill-based': 0.75, 'co-op': 0.12, 'fast-session': 0.05, 'brain-rot': -0.3, cozy: 0.12, social: 0.14 }),
        preferenceRDByTag: vector({ 'skill-based': 0.55, 'co-op': 0.5, 'fast-session': 0.55, 'brain-rot': 0.5, cozy: 0.55, social: 0.55 }),
        signalModel: makeSignalModel(
          { 'skill-based': 0.45, 'co-op': 0.4, 'fast-session': 0.32, 'brain-rot': 0.35, cozy: 0.62, social: 0.6 },
          {
            trustEstimate: 0.68,
            trustRD: 0.32,
            signalVolatility: 0.14,
            sourceAuthority: 1,
            signalAlignmentByTag: { 'skill-based': 0.45, 'co-op': 0.2, 'fast-session': 0.15, 'brain-rot': -0.2, cozy: 0.55, social: 0.5 }
          }
        )
      });
      const skillIsland = makeIsland({ id: 'island-hard-skill', label: 'Hard Skill Island', audienceFitByTag: vector({ 'skill-based': 0.72, cozy: -0.3, social: -0.15 }), audienceFitRDByTag: vector({ 'skill-based': 0.4, cozy: 0.5, social: 0.5 }) });
      const cozyIsland = makeIsland({ id: 'island-cozy-hangout', label: 'Cozy Hangout', descriptiveTagProfile: vector({ 'skill-based': -0.35, cozy: 0.86, social: 0.72 }), audienceFitByTag: vector({ 'skill-based': -0.28, cozy: 0.74, social: 0.62 }), audienceFitRDByTag: vector({ 'skill-based': 0.52, cozy: 0.48, social: 0.5 }) });
      return buildFixtureState(
        'declared-vs-demonstrated-mismatch',
        [
          event('fixture-7:event-0', -1, { turn: 1, userId: player.id, islandId: skillIsland.id, focusTag: 'skill-based', selectionReason: 'declaredObservedMismatchProbe' }),
          event('fixture-7:event-1', 1, { turn: 2, userId: player.id, islandId: cozyIsland.id, focusTag: 'cozy', selectionReason: 'observedAffinityFit' }),
          event('fixture-7:event-2', 1, { turn: 3, userId: player.id, islandId: cozyIsland.id, focusTag: 'social', selectionReason: 'observedAffinityFit' })
        ],
        'hidden truth diverges from declared preference; observed ratings should start moving demonstrated affinity toward cozy/social without mutating declared identity',
        makeState([player], [skillIsland, cozyIsland]),
        makeOracle(
          { [player.id]: { preferenceByTag: vector({ 'skill-based': -0.2, cozy: 0.85, social: 0.76 }), notes: 'Hidden oracle: the temp player claims skill-based but actually prefers cozy/social.' } },
          {
            [skillIsland.id]: { audienceFitByTag: vector({ 'skill-based': 0.8, cozy: -0.35, social: -0.2 }) },
            [cozyIsland.id]: { audienceFitByTag: vector({ cozy: 0.82, social: 0.74, 'skill-based': -0.3 }) }
          },
          ['Do not rewrite declared preference.', 'Demonstrated cozy/social affinity should rise across observations.', 'Skill-based demonstrated affinity should fall only from observed contradiction.']
        )
      );
    }
    case 'aligned-positive':
    case 'basic':
    default:
      return buildFixtureState(
        fixtureId === 'aligned-positive' ? 'aligned-positive' : 'basic',
        [event('fixture-0:event-0', 1)],
        'positive focused vote reinforces the island as a fit for players seeking skill-based play',
        makeState([makePlayer()], [makeIsland()]),
        makeOracle(
          { 'player-skill-scout': skillScoutTruth() },
          { 'island-skill-arena': skillArenaTruth() },
          ['Prediction should be positive before update.', 'Audience fit and confidence should move upward for skill-based evidence.']
        )
      );
  }
}

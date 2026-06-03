import type { HiddenIslandTruth, HiddenPlayerTruth, ModelId, RatingValue, TagId } from './types.js';

export type HiddenActorArchetype =
  | 'seed'
  | 'seedLike'
  | 'almostSeedLike'
  | 'inverseSeedLike'
  | 'disconnected'
  | 'noisy'
  | 'custom';

export type HiddenIslandTruthClass =
  | 'seedPositiveUnrated'
  | 'seedNegativeUnrated'
  | 'overlapCalibration'
  | 'wrongLaneControl'
  | 'disconnectedControl'
  | 'custom';

export interface ScenarioActorTruth extends HiddenPlayerTruth {
  readonly actorId: ModelId;
  readonly label: string;
  readonly behaviorArchetype: HiddenActorArchetype;
  readonly seedReferenceId?: ModelId;
  readonly seedSimilarity?: number;
  readonly inverseSimilarity?: number;
  readonly laneScope: TagId[];
  /** 0 = inverse, 0.5 = disconnected/noisy, 1 = exact seed-copy behavior. */
  readonly ratingAlignment: number;
  readonly contradictionRate: number;
  readonly explorationBias: number;
}

export interface ScenarioIslandTruth extends HiddenIslandTruth {
  readonly islandId: ModelId;
  readonly label: string;
  readonly truthClass: HiddenIslandTruthClass;
  readonly intendedSeedFitById: Record<ModelId, number>;
  readonly laneScope: TagId[];
}

export const DEFAULT_SCENARIO_TAGS: TagId[] = ['skill-based', 'co-op', 'fast-session', 'brain-rot', 'cozy', 'social'];

export function scenarioVector(values: Partial<Record<TagId, number>>, tags: readonly TagId[] = DEFAULT_SCENARIO_TAGS): Record<TagId, number> {
  return Object.fromEntries(tags.map((tag) => [tag, values[tag] ?? 0])) as Record<TagId, number>;
}

export function blendToward(
  base: Record<TagId, number>,
  target: Record<TagId, number>,
  strength: number,
  tags: readonly TagId[] = DEFAULT_SCENARIO_TAGS
): Record<TagId, number> {
  return Object.fromEntries(tags.map((tag) => [tag, base[tag] + (target[tag] - base[tag]) * strength])) as Record<TagId, number>;
}

export function inverseVector(vector: Record<TagId, number>, tags: readonly TagId[] = DEFAULT_SCENARIO_TAGS): Record<TagId, number> {
  return Object.fromEntries(tags.map((tag) => [tag, -(vector[tag] ?? 0)])) as Record<TagId, number>;
}

export function seedActor(actorId: ModelId, label: string, preferenceByTag: Record<TagId, number>, laneScope: TagId[]): ScenarioActorTruth {
  return {
    actorId,
    label,
    preferenceByTag: { ...preferenceByTag },
    behaviorArchetype: 'seed',
    laneScope: laneScope.slice(),
    ratingAlignment: 1,
    contradictionRate: 0,
    explorationBias: 0.1,
    notes: `${label} is a hidden trust-root seed.`
  };
}

export function seedLikeActor(
  actorId: ModelId,
  label: string,
  seed: ScenarioActorTruth,
  similarity: number,
  archetype: HiddenActorArchetype = 'seedLike'
): ScenarioActorTruth {
  const neutral = scenarioVector({});
  return {
    actorId,
    label,
    preferenceByTag: blendToward(neutral, seed.preferenceByTag, similarity),
    behaviorArchetype: archetype,
    seedReferenceId: seed.actorId,
    seedSimilarity: similarity,
    laneScope: seed.laneScope.slice(),
    ratingAlignment: similarity,
    contradictionRate: Math.max(0, 1 - similarity),
    explorationBias: 0.2,
    notes: `${label} is hidden ${seed.label}-like behavior with similarity ${similarity}.`
  };
}

export function inverseSeedLikeActor(actorId: ModelId, label: string, seed: ScenarioActorTruth, similarity: number): ScenarioActorTruth {
  return {
    actorId,
    label,
    preferenceByTag: blendToward(scenarioVector({}), inverseVector(seed.preferenceByTag), similarity),
    behaviorArchetype: 'inverseSeedLike',
    seedReferenceId: seed.actorId,
    inverseSimilarity: similarity,
    laneScope: seed.laneScope.slice(),
    ratingAlignment: 1 - similarity,
    contradictionRate: 0,
    explorationBias: 0.2,
    notes: `${label} is hidden inverse-${seed.label} behavior with similarity ${similarity}.`
  };
}

export function disconnectedActor(actorId: ModelId, label: string): ScenarioActorTruth {
  return {
    actorId,
    label,
    preferenceByTag: scenarioVector({ 'skill-based': 0.02, 'co-op': -0.01, 'fast-session': 0.01, 'brain-rot': -0.02, cozy: 0.03, social: 0 }),
    behaviorArchetype: 'disconnected',
    laneScope: DEFAULT_SCENARIO_TAGS.slice(),
    ratingAlignment: 0.5,
    contradictionRate: 0.5,
    explorationBias: 0.5,
    notes: `${label} is intentionally disconnected from the seed lane.`
  };
}

export function seedFitIsland(
  islandId: ModelId,
  label: string,
  seed: ScenarioActorTruth,
  expectedSeedFit: number,
  truthClass: HiddenIslandTruthClass,
  laneScope: TagId[]
): ScenarioIslandTruth {
  const laneValue = expectedSeedFit >= 0 ? 0.92 : -0.92;
  const audienceFitByTag = scenarioVector(Object.fromEntries(laneScope.map((tag) => [tag, laneValue])) as Partial<Record<TagId, number>>);
  return {
    islandId,
    label,
    truthClass,
    laneScope: laneScope.slice(),
    intendedSeedFitById: { [seed.actorId]: expectedSeedFit },
    descriptiveTagProfile: scenarioVector(Object.fromEntries(laneScope.map((tag) => [tag, Math.abs(laneValue)])) as Partial<Record<TagId, number>>),
    audienceFitByTag,
    notes: `${label} is hidden ${expectedSeedFit >= 0 ? 'positive' : 'negative'} for ${seed.label}; visible model should learn this only from evidence.`
  };
}

export function ratingFromHiddenTruth(actor: ScenarioActorTruth, island: ScenarioIslandTruth, tags: readonly TagId[] = DEFAULT_SCENARIO_TAGS): RatingValue {
  const activeTags = island.laneScope.length > 0 ? island.laneScope : tags;
  const score = activeTags.reduce((sum, tag) => sum + (actor.preferenceByTag[tag] ?? 0) * (island.audienceFitByTag?.[tag] ?? 0), 0) / activeTags.length;
  if (score >= 0.22) {
    return 1;
  }
  if (score <= -0.22) {
    return -1;
  }
  return 0;
}

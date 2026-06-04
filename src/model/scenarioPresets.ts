import type { AlignmentDistribution } from '../generator/columbusGenerator.js';
import { SCENARIO_CATALOG, type ScenarioCatalogDemoPreset } from './scenarioCatalog.js';
import type { IslandClass } from './types.js';
import type { AdvancePolicyTurnConfig } from './simulation.js';

export type ScenarioPresetId =
  | 'golden-demo'
  | 'controlled-comparison'
  | 'low-alignment-stress'
  | 'small-smoke-test';

const SCENARIO_PRESET_IDS: ScenarioPresetId[] = [
  'golden-demo',
  'controlled-comparison',
  'low-alignment-stress',
  'small-smoke-test'
];

export interface ScenarioPresetMetadata {
  id: string;
  label: string;
  modelingTraceFixtureId?: string;
  modelingTraceLabel?: string;
}

export interface ScenarioPresetGeneratorConfig {
  seed: number;
  numUsers: number;
  numIslands: number;
  bootstrapRatingsPerUser: number;
  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;
  islandClassWeights?: Partial<Record<IslandClass, number>>;
}

export interface ScenarioPreset {
  id: ScenarioPresetId;
  label: string;
  description: string;
  goodFor: string;
  generatorConfig: ScenarioPresetGeneratorConfig;
  turnPolicy: AdvancePolicyTurnConfig;
  turnsToRun: number;
}

export interface ScenarioPresetControls {
  seed: number;
  numUsers: number;
  numIslands: number;
  bootstrapRatingsPerUser: number;
  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;
  islandClassWeights?: Partial<Record<IslandClass, number>>;
  turnPolicy: AdvancePolicyTurnConfig;
  turnsToRun: number;
}

function assertScenarioPresetId(id: string): asserts id is ScenarioPresetId {
  if (!SCENARIO_PRESET_IDS.includes(id as ScenarioPresetId)) {
    throw new Error(`Unknown scenario preset id: ${id}`);
  }
}

function toScenarioPreset(preset: ScenarioCatalogDemoPreset): ScenarioPreset {
  assertScenarioPresetId(preset.id);

  return {
    id: preset.id,
    label: preset.label,
    description: preset.description,
    goodFor: preset.goodFor,
    generatorConfig: {
      seed: preset.generatorConfig.seed,
      numUsers: preset.generatorConfig.numUsers,
      numIslands: preset.generatorConfig.numIslands,
      bootstrapRatingsPerUser: preset.generatorConfig.bootstrapRatingsPerUser,
      tagAlignmentDistribution: preset.generatorConfig.tagAlignmentDistribution,
      ratingAlignmentDistribution: preset.generatorConfig.ratingAlignmentDistribution,
      islandClassWeights: preset.generatorConfig.islandClassWeights
    },
    turnPolicy: { ...preset.turnPolicy },
    turnsToRun: preset.turnsToRun
  };
}

export const SCENARIO_PRESETS: Record<ScenarioPresetId, ScenarioPreset> = Object.fromEntries(
  SCENARIO_CATALOG.demoPresets.map((preset) => {
    const mapped = toScenarioPreset(preset);
    return [mapped.id, mapped] as const;
  })
) as Record<ScenarioPresetId, ScenarioPreset>;

export function listScenarioPresets(): ScenarioPreset[] {
  return SCENARIO_PRESET_IDS.map((id) => SCENARIO_PRESETS[id]);
}

export function getScenarioPreset(id: ScenarioPresetId): ScenarioPreset {
  return SCENARIO_PRESETS[id];
}

export function getScenarioPresetMetadata(id: ScenarioPresetId): ScenarioPresetMetadata {
  const preset = SCENARIO_PRESETS[id];
  return {
    id: preset.id,
    label: preset.label,
    ...(preset.id === 'golden-demo'
       ? {
            modelingTraceFixtureId: 'seed-proxy-scenario-matrix',
            modelingTraceLabel: 'Authority Matrix Demo'
          }
       : {})
  };
}

export function stripScenarioPresetRuntimeMetadata(metadata: ScenarioPresetMetadata | null): ScenarioPresetMetadata | null {
  if (!metadata) {
    return null;
  }

  return {
    id: metadata.id,
    label: metadata.label
  };
}

export function resolveScenarioPresetFromControls(controls: ScenarioPresetControls): ScenarioPreset | null {
  return listScenarioPresets().find((preset) => matchesScenarioPreset(preset, controls)) ?? null;
}

export function matchesScenarioPreset(preset: ScenarioPreset, controls: ScenarioPresetControls): boolean {
  return (
    preset.generatorConfig.seed === controls.seed &&
    preset.generatorConfig.numUsers === controls.numUsers &&
    preset.generatorConfig.numIslands === controls.numIslands &&
    preset.generatorConfig.bootstrapRatingsPerUser === controls.bootstrapRatingsPerUser &&
    JSON.stringify(preset.generatorConfig.tagAlignmentDistribution) === JSON.stringify(controls.tagAlignmentDistribution) &&
    JSON.stringify(preset.generatorConfig.ratingAlignmentDistribution) === JSON.stringify(controls.ratingAlignmentDistribution) &&
    JSON.stringify(preset.generatorConfig.islandClassWeights ?? null) === JSON.stringify(controls.islandClassWeights ?? null) &&
    preset.turnPolicy.turnMode === controls.turnPolicy.turnMode &&
    preset.turnPolicy.participationModel === controls.turnPolicy.participationModel &&
    preset.turnPolicy.participatingUsersPerTurn === controls.turnPolicy.participatingUsersPerTurn &&
    preset.turnPolicy.participationChance === controls.turnPolicy.participationChance &&
    preset.turnPolicy.organicRatingCountModel === controls.turnPolicy.organicRatingCountModel &&
    preset.turnPolicy.organicRatingsPerUser === controls.turnPolicy.organicRatingsPerUser &&
    preset.turnPolicy.organicRatingDice === controls.turnPolicy.organicRatingDice &&
    preset.turnPolicy.guidedRatingCountModel === controls.turnPolicy.guidedRatingCountModel &&
    preset.turnPolicy.guidedRecommendationsPerUser === controls.turnPolicy.guidedRecommendationsPerUser &&
    preset.turnPolicy.guidedRecommendationDice === controls.turnPolicy.guidedRecommendationDice &&
    preset.turnPolicy.routingRiskProfile === controls.turnPolicy.routingRiskProfile &&
    preset.turnPolicy.customExplorationWeight === controls.turnPolicy.customExplorationWeight &&
    preset.turnPolicy.customBadFitGuardThreshold === controls.turnPolicy.customBadFitGuardThreshold &&
    preset.turnsToRun === controls.turnsToRun
  );
}

export function applyScenarioPreset(preset: ScenarioPreset): ScenarioPresetControls {
  return {
    seed: preset.generatorConfig.seed,
    numUsers: preset.generatorConfig.numUsers,
    numIslands: preset.generatorConfig.numIslands,
    bootstrapRatingsPerUser: preset.generatorConfig.bootstrapRatingsPerUser,
    tagAlignmentDistribution: preset.generatorConfig.tagAlignmentDistribution,
    ratingAlignmentDistribution: preset.generatorConfig.ratingAlignmentDistribution,
    islandClassWeights: preset.generatorConfig.islandClassWeights,
    turnPolicy: { ...preset.turnPolicy },
    turnsToRun: preset.turnsToRun
  };
}

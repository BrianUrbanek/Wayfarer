import type { AlignmentDistribution } from '../generator/columbusGenerator.js';
import type { RoutingRiskProfile, TurnMode } from './turnPolicy.js';
import type { IslandClass } from './types.js';
import type { AdvancePolicyTurnConfig } from './simulation.js';

export type ScenarioPresetId =
  | 'golden-demo'
  | 'controlled-comparison'
  | 'low-alignment-stress'
  | 'small-smoke-test';

export interface ScenarioPresetMetadata {
  id: string;
  label: string;
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

function buildTurnPolicy(overrides: {
  turnMode: TurnMode;
  participationModel: AdvancePolicyTurnConfig['participationModel'];
  participatingUsersPerTurn: number;
  participationChance: number;
  organicRatingCountModel: AdvancePolicyTurnConfig['organicRatingCountModel'];
  organicRatingsPerUser: number;
  organicRatingDice: AdvancePolicyTurnConfig['organicRatingDice'];
  guidedRatingCountModel: AdvancePolicyTurnConfig['guidedRatingCountModel'];
  guidedRecommendationsPerUser: number;
  guidedRecommendationDice: AdvancePolicyTurnConfig['guidedRecommendationDice'];
  routingRiskProfile: RoutingRiskProfile;
  customExplorationWeight: number;
  customMinimumPredictedFit: number;
}): AdvancePolicyTurnConfig {
  return {
    turnMode: overrides.turnMode,
    participationModel: overrides.participationModel,
    participatingUsersPerTurn: overrides.participatingUsersPerTurn,
    participationChance: overrides.participationChance,
    organicRatingCountModel: overrides.organicRatingCountModel,
    organicRatingsPerUser: overrides.organicRatingsPerUser,
    organicRatingDice: overrides.organicRatingDice,
    guidedRatingCountModel: overrides.guidedRatingCountModel,
    guidedRecommendationsPerUser: overrides.guidedRecommendationsPerUser,
    guidedRecommendationDice: overrides.guidedRecommendationDice,
    routingRiskProfile: overrides.routingRiskProfile,
    customExplorationWeight: overrides.customExplorationWeight,
    customMinimumPredictedFit: overrides.customMinimumPredictedFit
  };
}

function buildPreset(overrides: ScenarioPreset): ScenarioPreset {
  return overrides;
}

export const SCENARIO_PRESETS: Record<ScenarioPresetId, ScenarioPreset> = {
  'golden-demo': buildPreset({
    id: 'golden-demo',
    label: 'Golden Demo',
    description: 'Legible portfolio demo conditions with clean signal and enough volume to show the loop quickly.',
    goodFor: 'Best for walkthroughs, stakeholder demos, and quick inspection of the full discovery loop.',
    generatorConfig: {
      seed: 73021,
      numUsers: 45,
      numIslands: 36,
      bootstrapRatingsPerUser: 6,
      tagAlignmentDistribution: { kind: 'uniform', min: 6, max: 10 },
      ratingAlignmentDistribution: { kind: 'uniform', min: 6, max: 10 }
    },
    turnPolicy: buildTurnPolicy({
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 12,
      participationChance: 0.35,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 4,
      organicRatingDice: '1d3',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 3,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'balanced',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: 0.25
    }),
    turnsToRun: 5
  }),
  'controlled-comparison': buildPreset({
    id: 'controlled-comparison',
    label: 'Controlled Comparison',
    description: 'A tighter comparison world for Organic, Guided, and Mixed under the same generated dataset.',
    goodFor: 'Best for comparing turn modes without extra noise or huge sample volume.',
    generatorConfig: {
      seed: 82461,
      numUsers: 90,
      numIslands: 36,
      bootstrapRatingsPerUser: 6,
      tagAlignmentDistribution: { kind: 'uniform', min: 8, max: 10 },
      ratingAlignmentDistribution: { kind: 'uniform', min: 8, max: 10 }
    },
    turnPolicy: buildTurnPolicy({
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 12,
      participationChance: 0.35,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 4,
      organicRatingDice: '1d3',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 3,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'balanced',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: 0.25
    }),
    turnsToRun: 5
  }),
  'low-alignment-stress': buildPreset({
    id: 'low-alignment-stress',
    label: 'Low-Alignment Stress',
    description: 'Noisier worlds that should stay cautious instead of looking overconfident.',
    goodFor: 'Best for checking how the model behaves when the synthetic population is less aligned.',
    generatorConfig: {
      seed: 90573,
      numUsers: 90,
      numIslands: 36,
      bootstrapRatingsPerUser: 6,
      tagAlignmentDistribution: { kind: 'uniform', min: 0, max: 5 },
      ratingAlignmentDistribution: { kind: 'uniform', min: 0, max: 5 }
    },
    turnPolicy: buildTurnPolicy({
      turnMode: 'mixed',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 12,
      participationChance: 0.35,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 4,
      organicRatingDice: '1d3',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 3,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'conservative',
      customExplorationWeight: 0.25,
      customMinimumPredictedFit: 0.45
    }),
    turnsToRun: 5
  }),
  'small-smoke-test': buildPreset({
    id: 'small-smoke-test',
    label: 'Small Smoke Test',
    description: 'A lightweight browser-check scenario that stays close to the app’s current default feel.',
    goodFor: 'Best for quick manual checks, UI sanity passes, and short turn-by-turn inspection.',
    generatorConfig: {
      seed: 48291,
      numUsers: 48,
      numIslands: 18,
      bootstrapRatingsPerUser: 4,
      tagAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 },
      ratingAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 }
    },
    turnPolicy: buildTurnPolicy({
      turnMode: 'organic',
      participationModel: 'fixed-count',
      participatingUsersPerTurn: 6,
      participationChance: 0.35,
      organicRatingCountModel: 'fixed-count',
      organicRatingsPerUser: 3,
      organicRatingDice: '1d3',
      guidedRatingCountModel: 'fixed-count',
      guidedRecommendationsPerUser: 2,
      guidedRecommendationDice: '1d2',
      routingRiskProfile: 'balanced',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: 0.25
    }),
    turnsToRun: 5
  })
};

export function listScenarioPresets(): ScenarioPreset[] {
  return Object.values(SCENARIO_PRESETS);
}

export function getScenarioPreset(id: ScenarioPresetId): ScenarioPreset {
  return SCENARIO_PRESETS[id];
}

export function getScenarioPresetMetadata(id: ScenarioPresetId): ScenarioPresetMetadata {
  const preset = SCENARIO_PRESETS[id];
  return {
    id: preset.id,
    label: preset.label
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
    preset.turnPolicy.customMinimumPredictedFit === controls.turnPolicy.customMinimumPredictedFit &&
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

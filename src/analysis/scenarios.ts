import { DEFAULT_TURN_POLICY } from '../model/turnPolicy.js';
import { getScenarioPreset, type ScenarioPresetId } from '../model/scenarioPresets.js';
import {
  EXPERIMENT_POLICY_DESCRIPTIONS,
  EXPERIMENT_POLICY_LABELS,
  type ExperimentPolicyCase,
  type ExperimentScenarioCatalog,
  type ExperimentScenarioDefinition
} from './experimentTypes.js';

function buildTurnPolicyTemplate() {
  const { turnMode: _turnMode, turnBatchCount: _turnBatchCount, ...template } = DEFAULT_TURN_POLICY;
  return template;
}

const SHARED_POLICY_TEMPLATE = buildTurnPolicyTemplate();
const SHARED_SEEDS = [1201, 1202, 1203];
const SHARED_POLICY_CASES: readonly ExperimentPolicyCase[] = [
  {
    slug: 'organic',
    label: EXPERIMENT_POLICY_LABELS.organic,
    description: EXPERIMENT_POLICY_DESCRIPTIONS.organic
  },
  {
    slug: 'guided',
    label: EXPERIMENT_POLICY_LABELS.guided,
    description: EXPERIMENT_POLICY_DESCRIPTIONS.guided
  },
  {
    slug: 'mixed',
    label: EXPERIMENT_POLICY_LABELS.mixed,
    description: EXPERIMENT_POLICY_DESCRIPTIONS.mixed
  }
];

function fromPreset(slug: ScenarioPresetId): ExperimentScenarioDefinition {
  const preset = getScenarioPreset(slug);
  return {
    slug: preset.id,
    label: preset.label,
    description: preset.description,
    seedList: SHARED_SEEDS,
    userCount: preset.generatorConfig.numUsers,
    islandCount: preset.generatorConfig.numIslands,
    bootstrapRatingsPerUser: preset.generatorConfig.bootstrapRatingsPerUser,
    turnCount: preset.turnsToRun,
    generatorConfig: {
      tagAlignmentDistribution: preset.generatorConfig.tagAlignmentDistribution,
      ratingAlignmentDistribution: preset.generatorConfig.ratingAlignmentDistribution,
      islandClassWeights: preset.generatorConfig.islandClassWeights
    },
    turnPolicyTemplate: {
      ...SHARED_POLICY_TEMPLATE,
      participationModel: preset.turnPolicy.participationModel,
      participatingUsersPerTurn: preset.turnPolicy.participatingUsersPerTurn,
      participationChance: preset.turnPolicy.participationChance,
      organicRatingCountModel: preset.turnPolicy.organicRatingCountModel,
      organicRatingsPerUser: preset.turnPolicy.organicRatingsPerUser,
      organicRatingDice: preset.turnPolicy.organicRatingDice,
      guidedRatingCountModel: preset.turnPolicy.guidedRatingCountModel,
      guidedRecommendationsPerUser: preset.turnPolicy.guidedRecommendationsPerUser,
      guidedRecommendationDice: preset.turnPolicy.guidedRecommendationDice,
      routingRiskProfile: preset.turnPolicy.routingRiskProfile,
      customExplorationWeight: preset.turnPolicy.customExplorationWeight,
      customBadFitGuardThreshold: preset.turnPolicy.customBadFitGuardThreshold
    },
    policyCases: SHARED_POLICY_CASES,
    presetAligned: true
  };
}

const PRESET_SCENARIOS: ExperimentScenarioCatalog = {
  'golden-demo': fromPreset('golden-demo'),
  'controlled-comparison': fromPreset('controlled-comparison'),
  'low-alignment-stress': fromPreset('low-alignment-stress'),
  'small-smoke-test': fromPreset('small-smoke-test')
};

const LEGACY_ALIAS_TO_PRESET: Readonly<Record<string, ScenarioPresetId>> = {
  baseline: 'golden-demo',
  'low-alignment': 'low-alignment-stress'
};

export const EXPERIMENT_SCENARIOS: ExperimentScenarioCatalog = PRESET_SCENARIOS;

export function listExperimentScenarioDefinitions(): ExperimentScenarioDefinition[] {
  return Object.values(EXPERIMENT_SCENARIOS);
}

export function resolveExperimentScenarioDefinition(slug: string): ExperimentScenarioDefinition | null {
  const normalized = LEGACY_ALIAS_TO_PRESET[slug] ?? slug;
  return EXPERIMENT_SCENARIOS[normalized] ?? null;
}

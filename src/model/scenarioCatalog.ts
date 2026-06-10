import rawScenarioCatalog from '../data/scenario-catalog.json' with { type: 'json' };
import type { AlignmentDistribution } from '../generator/columbusGenerator.js';
import type { AdvancePolicyTurnConfig } from './simulation.js';
import type { IslandClass, IslandUpdateCadenceProfile } from './types.js';

export interface ScenarioCatalogDemoPreset {
  id: string;
  label: string;
  description: string;
  goodFor: string;
  generatorConfig: {
    seed: number;
    numUsers: number;
    numIslands: number;
    bootstrapRatingsPerUser: number;
    tagAlignmentDistribution: AlignmentDistribution;
    ratingAlignmentDistribution: AlignmentDistribution;
    islandClassWeights?: Partial<Record<IslandClass, number>>;
    islandUpdateCadenceProfiles?: Partial<Record<string, IslandUpdateCadenceProfile>>;
  };
  turnPolicy: AdvancePolicyTurnConfig;
  turnsToRun: number;
}

export interface ScenarioCatalogHarnessPolicyCase {
  id: string;
  label: string;
  description: string;
  turnPolicy: AdvancePolicyTurnConfig;
}

export interface ScenarioCatalogHarnessAlignmentFamily {
  id: string;
  label: string;
  description: string;
  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;
}

export interface ScenarioCatalogHarnessCharacterization {
  label: string;
  description: string;
  baseScenario: {
    numUsers: number;
    numIslands: number;
    bootstrapRatingsPerUser: [number, number];
    turnsToRun: number;
  };
  seedPlan: {
    starterSeeds: number[];
    recommendedSeeds: number;
  };
  policyCases: ScenarioCatalogHarnessPolicyCase[];
  alignmentFamilies: ScenarioCatalogHarnessAlignmentFamily[];
}

export interface ScenarioCatalogFile {
  version: 1;
  demoPresets: ScenarioCatalogDemoPreset[];
  harnessCharacterization: ScenarioCatalogHarnessCharacterization;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isIslandUpdateCadenceProfile(value: unknown): value is IslandUpdateCadenceProfile {
  return value === 'dormant' || value === 'slow' || value === 'steady' || value === 'active' || value === 'frenetic';
}

function isAlignmentDistribution(value: unknown): value is AlignmentDistribution {
  return (
    isRecord(value) &&
    value.kind === 'uniform' &&
    isNumber(value.min) &&
    isNumber(value.max)
  );
}

function isTurnPolicy(value: unknown): value is AdvancePolicyTurnConfig {
  return (
    isRecord(value) &&
    (value.turnMode === 'organic' || value.turnMode === 'guided' || value.turnMode === 'mixed') &&
    (value.participationModel === 'fixed-count' || value.participationModel === 'chance-per-user') &&
    isNumber(value.participatingUsersPerTurn) &&
    isNumber(value.participationChance) &&
    (value.organicRatingCountModel === 'fixed-count' || value.organicRatingCountModel === 'dice-expression') &&
    isNumber(value.organicRatingsPerUser) &&
    isString(value.organicRatingDice) &&
    (value.guidedRatingCountModel === 'fixed-count' || value.guidedRatingCountModel === 'dice-expression') &&
    isNumber(value.guidedRecommendationsPerUser) &&
    isString(value.guidedRecommendationDice) &&
    (value.routingRiskProfile === 'conservative' ||
      value.routingRiskProfile === 'balanced' ||
      value.routingRiskProfile === 'exploratory' ||
      value.routingRiskProfile === 'custom') &&
    isNumber(value.customExplorationWeight) &&
    isNumber(value.customBadFitGuardThreshold) &&
    (value.heartbeat === undefined ||
      (isRecord(value.heartbeat) &&
        isNumber(value.heartbeat.gamePatchEveryNTurns) &&
        isNumber(value.heartbeat.gamePatchTurnOffset) &&
        isNumber(value.heartbeat.maxIslandInspectionsPerTurn) &&
        isNumber(value.heartbeat.maxIslandUpdatesPerTurn) &&
        isRecord(value.heartbeat.islandCadenceProfileWeights) &&
        Object.values(value.heartbeat.islandCadenceProfileWeights).every(isNumber)))
  );
}

function isDemoPreset(value: unknown): value is ScenarioCatalogDemoPreset {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.label) &&
    isString(value.description) &&
    isString(value.goodFor) &&
    isRecord(value.generatorConfig) &&
    isNumber(value.generatorConfig.seed) &&
    isNumber(value.generatorConfig.numUsers) &&
    isNumber(value.generatorConfig.numIslands) &&
    isNumber(value.generatorConfig.bootstrapRatingsPerUser) &&
    isAlignmentDistribution(value.generatorConfig.tagAlignmentDistribution) &&
    isAlignmentDistribution(value.generatorConfig.ratingAlignmentDistribution) &&
    (value.generatorConfig.islandClassWeights === undefined ||
      (isRecord(value.generatorConfig.islandClassWeights) &&
        Object.values(value.generatorConfig.islandClassWeights).every(isNumber))) &&
    (value.generatorConfig.islandUpdateCadenceProfiles === undefined ||
      (isRecord(value.generatorConfig.islandUpdateCadenceProfiles) &&
        Object.values(value.generatorConfig.islandUpdateCadenceProfiles).every(isIslandUpdateCadenceProfile))) &&
    isTurnPolicy(value.turnPolicy) &&
    isNumber(value.turnsToRun)
  );
}

function isHarnessPolicyCase(value: unknown): value is ScenarioCatalogHarnessPolicyCase {
  return isRecord(value) && isString(value.id) && isString(value.label) && isString(value.description) && isTurnPolicy(value.turnPolicy);
}

function isHarnessAlignmentFamily(value: unknown): value is ScenarioCatalogHarnessAlignmentFamily {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.label) &&
    isString(value.description) &&
    isAlignmentDistribution(value.tagAlignmentDistribution) &&
    isAlignmentDistribution(value.ratingAlignmentDistribution)
  );
}

function validateScenarioCatalog(value: unknown): ScenarioCatalogFile {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Invalid scenario catalog version.');
  }

  if (!Array.isArray(value.demoPresets) || !value.demoPresets.every(isDemoPreset)) {
    throw new Error('Invalid demo preset block in scenario catalog.');
  }

  if (!isRecord(value.harnessCharacterization)) {
    throw new Error('Missing harness characterization block in scenario catalog.');
  }

  const harness = value.harnessCharacterization;

  if (
    !isString(harness.label) ||
    !isString(harness.description) ||
    !isRecord(harness.baseScenario) ||
    !isNumber(harness.baseScenario.numUsers) ||
    !isNumber(harness.baseScenario.numIslands) ||
    !Array.isArray(harness.baseScenario.bootstrapRatingsPerUser) ||
    harness.baseScenario.bootstrapRatingsPerUser.length !== 2 ||
    !harness.baseScenario.bootstrapRatingsPerUser.every(isNumber) ||
    !isNumber(harness.baseScenario.turnsToRun) ||
    !isRecord(harness.seedPlan) ||
    !Array.isArray(harness.seedPlan.starterSeeds) ||
    !harness.seedPlan.starterSeeds.every(isNumber) ||
    !isNumber(harness.seedPlan.recommendedSeeds) ||
    !Array.isArray(harness.policyCases) ||
    !harness.policyCases.every(isHarnessPolicyCase) ||
    !Array.isArray(harness.alignmentFamilies) ||
    !harness.alignmentFamilies.every(isHarnessAlignmentFamily)
  ) {
    throw new Error('Invalid harness characterization block in scenario catalog.');
  }

  return value as unknown as ScenarioCatalogFile;
}

export const SCENARIO_CATALOG = validateScenarioCatalog(rawScenarioCatalog as unknown);

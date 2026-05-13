import type { AlignmentDistribution } from '../generator/columbusGenerator.js';
import type { AdvancePolicyTurnConfig, SimulationState, SimulationTurnSummary, RatingEvent, SerializedSimulationState } from './simulation.js';
import { hydrateSimulationState, serializeSimulationState } from './simulation.js';
import type { ScenarioPresetMetadata } from './scenarioPresets.js';
import type { CohortAnchor, Island, IslandClass, User } from './types.js';

export type SavedScenarioKind = 'simulation-state';
export const SAVED_SCENARIO_VERSION = 1 as const;

export interface SavedScenarioGeneratorConfig {
  seed: number;
  numUsers: number;
  numIslands: number;
  bootstrapRatingsPerUser: number;
  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;
  islandClassWeights?: Partial<Record<IslandClass, number>>;
}

export interface SavedWayfarerScenarioV1 {
  version: typeof SAVED_SCENARIO_VERSION;
  kind: SavedScenarioKind;
  label: string;
  createdAt: string;
  scenarioPreset?: ScenarioPresetMetadata | null;
  generatorConfig: SavedScenarioGeneratorConfig;
  turnPolicy: AdvancePolicyTurnConfig;
  turnsToRun: number;
  simulationState: SerializedSimulationState;
}

export interface SavedScenarioValidationSuccess {
  ok: true;
  scenario: SavedWayfarerScenarioV1;
  restoredState: SimulationState;
}

export interface SavedScenarioValidationFailure {
  ok: false;
  error: string;
}

export type SavedScenarioValidationResult = SavedScenarioValidationSuccess | SavedScenarioValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isMaybeRating(value: unknown): value is -1 | 0 | 1 | null {
  return value === null || value === -1 || value === 0 || value === 1;
}

function isRatingWeights(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNumber);
}

function validateUser(value: unknown): value is User {
  if (!isRecord(value)) {
    return false;
  }

  if (!isString(value.id) || !isString(value.label) || !isArrayOfStrings(value.declaredTags) || !isRecord(value.ratings)) {
    return false;
  }

  if (!Object.values(value.ratings).every(isMaybeRating)) {
    return false;
  }

  return true;
}

function validateIsland(value: unknown): value is Island {
  if (!isRecord(value)) {
    return false;
  }

  if (!isString(value.id) || !isString(value.label)) {
    return false;
  }

  if (value.hiddenAppealPattern && !isRecord(value.hiddenAppealPattern)) {
    return false;
  }

  if (value.hiddenClass !== undefined && !isString(value.hiddenClass)) {
    return false;
  }

  return true;
}

function validateCohort(value: unknown): value is CohortAnchor {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isString(value.id) ||
    !isString(value.label) ||
    !isArrayOfStrings(value.tags) ||
    !isRecord(value.ratings) ||
    !isString(value.source)
  ) {
    return false;
  }

  if (!Object.values(value.ratings).every(isMaybeRating)) {
    return false;
  }

  return true;
}

function validateRatingEvent(value: unknown): value is RatingEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isString(value.id) ||
    !isNumber(value.turn) ||
    !isString(value.userId) ||
    !isString(value.islandId) ||
    !isMaybeRating(value.rating) ||
    !isString(value.source) ||
    !isRatingWeights(value.raterSignalWeights)
  ) {
    return false;
  }

  return true;
}

function validateTurnSummary(value: unknown): value is SimulationTurnSummary {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNumber(value.turn) ||
    !isString(value.mode) ||
    !Array.isArray(value.participatingUserIds) ||
    !value.participatingUserIds.every(isString) ||
    !isNumber(value.ratingsCreated) ||
    !isNumber(value.organicRatingsCreated) ||
    !isNumber(value.guidedRatingsCreated) ||
    !Array.isArray(value.newlyRatedIslandIds) ||
    !value.newlyRatedIslandIds.every(isString) ||
    !Array.isArray(value.routedIslandIds) ||
    !value.routedIslandIds.every(isString) ||
    !isRecord(value.recommendationKinds) ||
    !isRecord(value.diagnosisCounts)
  ) {
    return false;
  }

  return true;
}

function validateSerializedSimulationState(value: unknown): value is SerializedSimulationState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNumber(value.seed) ||
    !isNumber(value.currentTurn) ||
    !isArrayOfStrings(value.allTags) ||
    !Array.isArray(value.latentUsers) ||
    !Array.isArray(value.cohorts) ||
    !Array.isArray(value.islands) ||
    !Array.isArray(value.ratingEvents) ||
    !Array.isArray(value.turnHistory)
  ) {
    return false;
  }

  if (!value.latentUsers.every(validateUser) || !value.cohorts.every(validateCohort) || !value.islands.every(validateIsland)) {
    return false;
  }

  if (!value.ratingEvents.every(validateRatingEvent) || !value.turnHistory.every(validateTurnSummary)) {
    return false;
  }

  return true;
}

function validateGeneratorConfig(value: unknown): value is SavedScenarioGeneratorConfig {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNumber(value.seed) ||
    !isNumber(value.numUsers) ||
    !isNumber(value.numIslands) ||
    !isNumber(value.bootstrapRatingsPerUser) ||
    !value.tagAlignmentDistribution ||
    !value.ratingAlignmentDistribution
  ) {
    return false;
  }

  if (
    value.islandClassWeights !== undefined &&
    (value.islandClassWeights === null || !isRecord(value.islandClassWeights) || !Object.values(value.islandClassWeights).every(isNumber))
  ) {
    return false;
  }

  return true;
}

function validateTurnPolicy(value: unknown): value is AdvancePolicyTurnConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
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
    isNumber(value.customMinimumPredictedFit)
  );
}

export function exportSavedWayfarerScenario(input: {
  label: string;
  createdAt: string;
  scenarioPreset?: ScenarioPresetMetadata | null;
  generatorConfig: SavedScenarioGeneratorConfig;
  turnPolicy: AdvancePolicyTurnConfig;
  turnsToRun: number;
  simulationState: SimulationState;
}): SavedWayfarerScenarioV1 {
  return {
    version: SAVED_SCENARIO_VERSION,
    kind: 'simulation-state',
    label: input.label,
    createdAt: input.createdAt,
    scenarioPreset: input.scenarioPreset ? { ...input.scenarioPreset } : undefined,
    generatorConfig: { ...input.generatorConfig },
    turnPolicy: { ...input.turnPolicy },
    turnsToRun: input.turnsToRun,
    simulationState: serializeSimulationState(input.simulationState)
  };
}

export function validateSavedWayfarerScenario(value: unknown): SavedScenarioValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: 'Saved scenario JSON must be an object.'
    };
  }

  if (value.version !== SAVED_SCENARIO_VERSION) {
    return {
      ok: false,
      error: 'Unsupported saved scenario version.'
    };
  }

  if (value.kind !== 'simulation-state') {
    return {
      ok: false,
      error: 'Unsupported saved scenario kind.'
    };
  }

  if (!isString(value.label) || !isString(value.createdAt)) {
    return {
      ok: false,
      error: 'Saved scenario is missing label or createdAt.'
    };
  }

  if (
    value.scenarioPreset !== undefined &&
    value.scenarioPreset !== null &&
    (!isRecord(value.scenarioPreset) || !isString(value.scenarioPreset.id) || !isString(value.scenarioPreset.label))
  ) {
    return {
      ok: false,
      error: 'Saved scenario has an invalid scenarioPreset.'
    };
  }

  if (!validateGeneratorConfig(value.generatorConfig)) {
    return {
      ok: false,
      error: 'Saved scenario has an invalid generatorConfig.'
    };
  }

  if (!validateTurnPolicy(value.turnPolicy)) {
    return {
      ok: false,
      error: 'Saved scenario has an invalid turnPolicy.'
    };
  }

  if (!isNumber(value.turnsToRun)) {
    return {
      ok: false,
      error: 'Saved scenario has an invalid turnsToRun value.'
    };
  }

  if (!validateSerializedSimulationState(value.simulationState)) {
    return {
      ok: false,
      error: 'Saved scenario has an invalid simulationState.'
    };
  }

  const scenario = value as unknown as SavedWayfarerScenarioV1;
  const restoredState = hydrateSimulationState(scenario.simulationState);

  if (restoredState.currentTurn !== scenario.simulationState.currentTurn) {
    return {
      ok: false,
      error: 'Saved scenario currentTurn does not match its turn history.'
    };
  }

  if (restoredState.ratingEvents.some((event) => !isRatingWeights(event.raterSignalWeights))) {
    return {
      ok: false,
      error: 'Saved scenario contains malformed rating event weights.'
    };
  }

  return {
    ok: true,
    scenario,
    restoredState
  };
}

export function parseSavedWayfarerScenario(jsonText: string): SavedScenarioValidationResult {
  try {
    return validateSavedWayfarerScenario(JSON.parse(jsonText) as unknown);
  } catch {
    return {
      ok: false,
      error: 'Saved scenario JSON could not be parsed.'
    };
  }
}

import { DEFAULT_TURN_POLICY } from '../model/turnPolicy.js';
import type { ExperimentScenarioCatalog, ExperimentScenarioDefinition } from './experimentTypes.js';

function buildTurnPolicyTemplate() {
  const { turnMode: _turnMode, turnBatchCount: _turnBatchCount, ...template } = DEFAULT_TURN_POLICY;
  return template;
}

const SHARED_POLICY_TEMPLATE = buildTurnPolicyTemplate();
const SHARED_SEEDS = [1201, 1202, 1203];

export const EXPERIMENT_SCENARIOS: ExperimentScenarioCatalog = {
  baseline: {
    slug: 'baseline',
    label: 'Baseline',
    description: 'A high-alignment starting point that shows the discovery loop under clean signal conditions.',
    seedList: SHARED_SEEDS,
    userCount: 10,
    islandCount: 12,
    bootstrapRatingsPerUser: 3,
    turnCount: 5,
    generatorConfig: {
      tagAlignmentDistribution: { kind: 'fixed', value: 10 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
    },
    turnPolicyTemplate: {
      ...SHARED_POLICY_TEMPLATE,
      participatingUsersPerTurn: 4,
      participationChance: 0.5,
      organicRatingsPerUser: 2,
      guidedRecommendationsPerUser: 2,
      routingRiskProfile: 'balanced',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: 0.25
    },
    policyCases: [
      {
        slug: 'organic',
        label: 'Organic Exploration',
        description: 'Organic-only exploration for the same seeded world.'
      },
      {
        slug: 'guided',
        label: 'Guided Discovery',
        description: 'Guided-only discovery for the same seeded world.'
      },
      {
        slug: 'mixed',
        label: 'Mixed',
        description: 'Shared participants can emit organic and guided ratings in the same turn.'
      }
    ]
  },
  'low-alignment': {
    slug: 'low-alignment',
    label: 'Low Alignment',
    description: 'A noisier starting point that uses the same turn policy but weaker user alignment.',
    seedList: SHARED_SEEDS,
    userCount: 10,
    islandCount: 12,
    bootstrapRatingsPerUser: 3,
    turnCount: 5,
    generatorConfig: {
      tagAlignmentDistribution: { kind: 'uniform', min: 0, max: 4 },
      ratingAlignmentDistribution: { kind: 'uniform', min: 0, max: 4 }
    },
    turnPolicyTemplate: {
      ...SHARED_POLICY_TEMPLATE,
      participatingUsersPerTurn: 4,
      participationChance: 0.5,
      organicRatingsPerUser: 2,
      guidedRecommendationsPerUser: 2,
      routingRiskProfile: 'balanced',
      customExplorationWeight: 0.55,
      customMinimumPredictedFit: 0.25
    },
    policyCases: [
      {
        slug: 'organic',
        label: 'Organic Exploration',
        description: 'Organic-only exploration for the same seeded world.'
      },
      {
        slug: 'guided',
        label: 'Guided Discovery',
        description: 'Guided-only discovery for the same seeded world.'
      },
      {
        slug: 'mixed',
        label: 'Mixed',
        description: 'Shared participants can emit organic and guided ratings in the same turn.'
      }
    ]
  }
};

export function listExperimentScenarioDefinitions(): ExperimentScenarioDefinition[] {
  return Object.values(EXPERIMENT_SCENARIOS);
}

export function resolveExperimentScenarioDefinition(slug: string): ExperimentScenarioDefinition | null {
  return EXPERIMENT_SCENARIOS[slug] ?? null;
}

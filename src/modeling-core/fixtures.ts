import { DEFAULT_TAGS } from '../data/defaultTags.js';
import { createDefaultCohorts } from '../data/defaultCohorts.js';
import { generateColumbusDataset } from '../generator/columbusGenerator.js';
import { createInitialSimulationState, type RatingEvent } from '../model/simulation.js';
import { getScenarioPreset } from '../model/scenarioPresets.js';
import type { ModelingFixtureState } from './types.js';

function buildFixtureState(
  fixtureId: string,
  seed: number,
  numUsers: number,
  numIslands: number,
  initialRatingsPerUser: number,
  ratingEvent: RatingEvent,
  description: string
): ModelingFixtureState {
  const dataset = generateColumbusDataset({
    seed,
    numUsers,
    numIslands,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: getScenarioPreset('small-smoke-test').generatorConfig.tagAlignmentDistribution,
    ratingAlignmentDistribution: getScenarioPreset('small-smoke-test').generatorConfig.ratingAlignmentDistribution
  });

  const simulationState = createInitialSimulationState({
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser
  });

  return {
    simulationState,
    targetUserId: ratingEvent.userId,
    targetIslandId: ratingEvent.islandId,
    ratingEvent,
    description: `${fixtureId}: ${description}`
  };
}

export function listModelingFixtureIds(): string[] {
  return ['basic', 'meh-observed'];
}

export function loadModelingFixture(fixtureId: string): ModelingFixtureState {
  switch (fixtureId) {
    case 'meh-observed':
      return buildFixtureState(
        'meh-observed',
        48291,
        8,
        6,
        2,
        {
          id: 'fixture-1:event-0',
          turn: 1,
          userId: 'user-1',
          islandId: 'island-1',
          rating: 0,
          source: 'organic',
          raterSignalWeights: {}
        },
        'neutral/observed trace case'
      );
    case 'basic':
    default:
      return buildFixtureState(
        'basic',
        73021,
        8,
        6,
        2,
        {
          id: 'fixture-0:event-0',
          turn: 1,
          userId: 'user-1',
          islandId: 'island-2',
          rating: 1,
          source: 'guided',
          raterSignalWeights: {}
        },
        'directional update trace case'
      );
  }
}

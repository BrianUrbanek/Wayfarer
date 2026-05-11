import type { CohortAnchor, CohortId, Island, IslandClass, Rating } from '../model/types';
import type { SeededRng } from './seededRandom';

export interface IslandGenerationOptions {
  rng: SeededRng;
  numIslands: number;
  cohorts: CohortAnchor[];
  islandClassWeights?: Partial<Record<IslandClass, number>>;
}

const DEFAULT_ISLAND_CLASS_WEIGHTS: Record<IslandClass, number> = {
  BROAD_HIT: 0.28,
  BROAD_DUD: 0.18,
  NICHE_COHORT: 0.26,
  POLARIZED_PAIR: 0.18,
  UNDECIDED: 0.10
};

function weightedChoice(rng: SeededRng, weights: Record<IslandClass, number>): IslandClass {
  const entries = Object.entries(weights) as [IslandClass, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng.next() * total;

  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) {
      return value;
    }
  }

  return entries[entries.length - 1][0];
}

function clampRating(value: number): Rating {
  if (value > 0) {
    return 1;
  }

  if (value < 0) {
    return -1;
  }

  return 0;
}

function classPattern(
  islandClass: IslandClass,
  cohortIndex: number,
  islandIndex: number,
  cohortId: CohortId
): Rating {
  const signature = [...cohortId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const bucket = (signature + islandIndex * 17 + cohortIndex * 13) % 100;

  switch (islandClass) {
    case 'BROAD_HIT':
      return bucket < 70 ? 1 : bucket < 90 ? 0 : -1;
    case 'BROAD_DUD':
      return bucket < 70 ? -1 : bucket < 90 ? 0 : 1;
    case 'NICHE_COHORT':
      return bucket % 5 === 0 ? 1 : bucket % 5 === 1 ? 0 : -1;
    case 'POLARIZED_PAIR':
      return (cohortIndex + islandIndex) % 2 === 0 ? 1 : -1;
    case 'UNDECIDED':
      return bucket < 55 ? 0 : bucket < 78 ? 1 : -1;
    default:
      return clampRating(0);
  }
}

export function generateIslands(options: IslandGenerationOptions): Island[] {
  const { rng, numIslands, cohorts } = options;
  const weights = {
    ...DEFAULT_ISLAND_CLASS_WEIGHTS,
    ...options.islandClassWeights
  } satisfies Record<IslandClass, number>;

  return Array.from({ length: numIslands }, (_, index) => {
    const hiddenClass = weightedChoice(rng, weights);
    const hiddenAppealPattern = Object.fromEntries(
      cohorts.map((cohort, cohortIndex) => [
        cohort.id,
        classPattern(hiddenClass, cohortIndex, index, cohort.id)
      ])
    ) as Record<CohortId, Rating>;

    return {
      id: `island-${index + 1}`,
      label: `Island ${index + 1}`,
      hiddenClass,
      hiddenAppealPattern
    };
  });
}

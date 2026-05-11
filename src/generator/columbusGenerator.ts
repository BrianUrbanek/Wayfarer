import type {
  CohortAnchor,
  CohortId,
  Island,
  IslandClass,
  TagId,
  User
} from '../model/types.js';
import { generateIslands } from './islandGeneration.js';
import { generateAlignedRatings, materializeCohortRatings } from './ratingGeneration.js';
import { createSeededRandom } from './seededRandom.js';
import { generateSeedLikeUserTags } from './tagGeneration.js';

export type AlignmentDistribution =
  | number
  | {
      kind: 'fixed';
      value: number;
    }
  | {
      kind: 'uniform';
      min: number;
      max: number;
    };

export interface GeneratorConfig {
  seed: number;
  numUsers: number;
  numIslands: number;
  cohorts: CohortAnchor[];
  allTags: TagId[];
  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;
  islandClassWeights?: Partial<Record<IslandClass, number>>;
}

export interface ColumbusDataset {
  allTags: TagId[];
  cohorts: CohortAnchor[];
  islands: Island[];
  users: User[];
}

function clampAlignment(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function sampleAlignment(
  rng: ReturnType<typeof createSeededRandom>,
  distribution: AlignmentDistribution
): number {
  if (typeof distribution === 'number') {
    return clampAlignment(distribution);
  }

  switch (distribution.kind) {
    case 'fixed':
      return clampAlignment(distribution.value);
    case 'uniform':
      return clampAlignment(rng.range(distribution.min, distribution.max));
    default:
      return 5;
  }
}

function cloneCohorts(cohorts: CohortAnchor[]): CohortAnchor[] {
  return cohorts.map((cohort) => ({
    ...cohort,
    tags: cohort.tags.slice(),
    ratings: { ...cohort.ratings }
  }));
}

function chooseSeedCohort(cohorts: CohortAnchor[], userIndex: number): CohortAnchor {
  if (cohorts.length === 0) {
    throw new Error('Cannot generate users without cohorts.');
  }

  return cohorts[userIndex % cohorts.length];
}

function userId(index: number): string {
  return `user-${index + 1}`;
}

function buildUser(
  index: number,
  allTags: readonly TagId[],
  cohorts: CohortAnchor[],
  islands: Island[],
  rng: ReturnType<typeof createSeededRandom>,
  tagAlignmentDistribution: AlignmentDistribution,
  ratingAlignmentDistribution: AlignmentDistribution
): User {
  const hiddenSeedCohort = chooseSeedCohort(cohorts, index);
  const hiddenTagAlignment = sampleAlignment(rng, tagAlignmentDistribution);
  const hiddenRatingAlignment = sampleAlignment(rng, ratingAlignmentDistribution);

  const declaredTags = generateSeedLikeUserTags(
    rng,
    allTags,
    hiddenSeedCohort,
    hiddenTagAlignment
  );
  const ratings = generateAlignedRatings(
    rng,
    islands,
    hiddenSeedCohort.ratings,
    hiddenRatingAlignment
  );

  return {
    id: userId(index),
    label: `User ${index + 1}`,
    declaredTags,
    ratings,
    hiddenSeedCohortId: hiddenSeedCohort.id as CohortId,
    hiddenTagAlignment,
    hiddenRatingAlignment
  };
}

export function generateColumbusDataset(config: GeneratorConfig): ColumbusDataset {
  const rng = createSeededRandom(config.seed);
  const allTags = config.allTags.slice();
  const baseCohorts = cloneCohorts(config.cohorts);
  const islands = generateIslands({
    rng,
    numIslands: config.numIslands,
    cohorts: baseCohorts,
    islandClassWeights: config.islandClassWeights
  });
  const cohorts = materializeCohortRatings(baseCohorts, islands);

  const users = Array.from({ length: config.numUsers }, (_, index) =>
    buildUser(
      index,
      allTags,
      cohorts,
      islands,
      rng,
      config.tagAlignmentDistribution,
      config.ratingAlignmentDistribution
    )
  );

  return {
    allTags,
    cohorts,
    islands,
    users
  };
}

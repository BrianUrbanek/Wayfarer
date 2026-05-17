import type {
  CohortAnchor,
  CohortId,
  Island,
  IslandClass,
  TagId,
  User
} from '../model/types.js';
import { generateIslands } from './islandGeneration.js';
import { materializeCohortRatings } from './ratingGeneration.js';
import { createSeededRandom } from './seededRandom.js';
import {
  buildReviewerArchetypeProfile,
  REVIEWER_ARCHETYPES,
  generateReviewerDeclaredTags,
  generateReviewerRatings
} from './reviewerArchetypeGeneration.js';

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
  // Deprecated legacy config: no longer mutates archetype behavior generation.
  tagAlignmentDistribution: AlignmentDistribution;
  // Deprecated legacy config: no longer mutates archetype behavior generation.
  ratingAlignmentDistribution: AlignmentDistribution;
  islandClassWeights?: Partial<Record<IslandClass, number>>;
}

export interface ColumbusDataset {
  allTags: TagId[];
  cohorts: CohortAnchor[];
  islands: Island[];
  users: User[];
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
  rng: ReturnType<typeof createSeededRandom>
): User {
  const hiddenSeedCohort = chooseSeedCohort(cohorts, index);
  const hiddenReviewerArchetype = REVIEWER_ARCHETYPES[index % REVIEWER_ARCHETYPES.length];
  const profile = buildReviewerArchetypeProfile(cohorts, index, hiddenReviewerArchetype);
  const hiddenTagAlignment = profile.tagAlignment;
  const hiddenRatingAlignment = profile.ratingAlignment;
  const declaredAlignment = profile.tagAlignment;
  const ratingAlignment = profile.ratingAlignment;

  const declaredTags = generateReviewerDeclaredTags(
    rng,
    allTags,
    cohorts.find((cohort) => cohort.id === profile.declaredCohortId) ?? hiddenSeedCohort,
    declaredAlignment
  );
  const ratings = generateReviewerRatings(
    rng,
    islands,
    cohorts.find((cohort) => cohort.id === profile.behaviorCohortId)?.ratings ?? hiddenSeedCohort.ratings,
    hiddenReviewerArchetype,
    ratingAlignment
  );

  return {
    id: userId(index),
    label: `User ${index + 1}`,
    declaredTags,
    ratings,
    hiddenSeedCohortId: hiddenSeedCohort.id as CohortId,
    hiddenDeclaredCohortId: profile.declaredCohortId,
    hiddenBehaviorCohortId: profile.behaviorCohortId,
    hiddenTagAlignment,
    hiddenRatingAlignment,
    hiddenReviewerArchetype,
    hiddenReviewerChecksum: profile.checksum
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
      rng
    )
  );

  return {
    allTags,
    cohorts,
    islands,
    users
  };
}

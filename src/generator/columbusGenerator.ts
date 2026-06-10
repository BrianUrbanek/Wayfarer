import type {
  CohortAnchor,
  CohortId,
  HiddenBehaviorProfile,
  Island,
  IslandClass,
  IslandUpdateCadenceProfile,
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
import {
  buildIslandTruth,
  buildTruthRatingsForTasteCohort,
  generateHiddenTasteCohorts
} from './hiddenTasteGeneration.js';
import type { HiddenTasteCohort } from '../model/types.js';

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
  islandUpdateCadenceProfiles?: Partial<Record<string, IslandUpdateCadenceProfile>>;
}

export interface ColumbusDataset {
  allTags: TagId[];
  cohorts: CohortAnchor[];
  hiddenTasteCohorts: HiddenTasteCohort[];
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

function chooseHiddenTasteCohort(
  hiddenTasteCohorts: readonly HiddenTasteCohort[],
  seed: number,
  index: number
): HiddenTasteCohort {
  if (hiddenTasteCohorts.length === 0) {
    throw new Error('Cannot generate users without hidden taste cohorts.');
  }

  const mixed = Math.imul(seed >>> 0, 1103515245) ^ Math.imul(index + 1, 12345);
  return hiddenTasteCohorts[Math.abs(mixed) % hiddenTasteCohorts.length] ?? hiddenTasteCohorts[0];
}

function chooseHiddenBehaviorProfile(seed: number, index: number): HiddenBehaviorProfile {
  const profiles: HiddenBehaviorProfile[] = ['aligned', 'positive-drift', 'negative-drift'];
  const mixed = Math.imul(seed >>> 0, 1103515245) ^ Math.imul(index + 1, 12345);
  return profiles[Math.abs(mixed) % profiles.length];
}

function buildUser(
  seed: number,
  index: number,
  allTags: readonly TagId[],
  cohorts: CohortAnchor[],
  islands: Island[],
  hiddenTasteCohorts: readonly HiddenTasteCohort[],
  rng: ReturnType<typeof createSeededRandom>
): User {
  const hiddenSeedCohort = chooseSeedCohort(cohorts, index);
  const hiddenReviewerArchetype = REVIEWER_ARCHETYPES[index % REVIEWER_ARCHETYPES.length];
  const profile = buildReviewerArchetypeProfile(cohorts, index, hiddenReviewerArchetype);
  const hiddenBehaviorProfile = chooseHiddenBehaviorProfile(seed, index);
  const hiddenTasteCohort =
    hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH'
      ? hiddenTasteCohorts.find(
          (entry) => entry.kind === 'seed' && entry.id === hiddenSeedCohort.id
        ) ?? chooseHiddenTasteCohort(hiddenTasteCohorts, seed, index)
      : chooseHiddenTasteCohort(hiddenTasteCohorts, seed, index);
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
  const truthRatings = buildTruthRatingsForTasteCohort(rng, islands, hiddenTasteCohort);
  const ratings = generateReviewerRatings(
    rng,
    islands,
    truthRatings,
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
    hiddenTasteCohortId: hiddenTasteCohort.id,
    hiddenTasteCohortKind: hiddenTasteCohort.kind,
    hiddenTastePreferenceVector: { ...hiddenTasteCohort.preferenceVector },
    hiddenBehaviorCohortId: hiddenTasteCohort.projectedSeedCohortId,
    hiddenBehaviorProfile,
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
  const hiddenTasteCohorts = generateHiddenTasteCohorts(rng, baseCohorts, allTags).hiddenTasteCohorts;
  const islands = generateIslands({
    rng,
    numIslands: config.numIslands,
    cohorts: baseCohorts,
    islandClassWeights: config.islandClassWeights
  });
  const truthAnnotatedIslands = islands.map((island, index) => {
    const truth = buildIslandTruth(rng, island, hiddenTasteCohorts, allTags, index);
    return {
      ...island,
      hiddenTruthClass: truth.hiddenTruthClass,
      hiddenTargetTasteCohortId: truth.hiddenTargetTasteCohortId,
      hiddenAppealVector: truth.hiddenAppealVector,
      updateCadenceProfile: config.islandUpdateCadenceProfiles?.[island.id]
    };
  });
  const cohorts = materializeCohortRatings(baseCohorts, truthAnnotatedIslands, hiddenTasteCohorts);

  const users = Array.from({ length: config.numUsers }, (_, index) =>
    buildUser(
      config.seed,
      index,
      allTags,
      cohorts,
      truthAnnotatedIslands,
      hiddenTasteCohorts,
      rng
    )
  );

  return {
    allTags,
    cohorts,
    hiddenTasteCohorts,
    islands: truthAnnotatedIslands,
    users
  };
}

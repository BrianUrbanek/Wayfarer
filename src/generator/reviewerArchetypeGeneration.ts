import type { CohortAnchor, CohortId, Island, Rating, ReviewerArchetype, TagId } from '../model/types.js';
import { generateAlignedRatings } from './ratingGeneration.js';
import { generateAlignedTags } from './tagGeneration.js';
import type { SeededRng } from './seededRandom.js';

export const REVIEWER_ARCHETYPES: readonly ReviewerArchetype[] = [
  'CLEAN_COHORT_MATCH',
  'MISLABELED_USER',
  'INVERSE_RATER',
  'RANDOM_NOISY_USER',
  'TINA_LIKE_DETACHED_PREDICTOR',
  'EARLY_SCOUT',
  'LATE_CONSENSUS_FOLLOWER',
  'POPULARITY_CHASER',
  'NICHE_SPECIALIST'
];

export interface ReviewerArchetypeProfile {
  archetype: ReviewerArchetype;
  declaredCohortId: CohortId;
  behaviorCohortId: CohortId;
  tagAlignment: number;
  ratingAlignment: number;
  checksum: string;
}

function chooseCohortId(cohorts: readonly CohortAnchor[], index: number): CohortId {
  if (cohorts.length === 0) {
    throw new Error('Cannot choose a reviewer cohort without cohort anchors.');
  }

  return cohorts[index % cohorts.length].id;
}

function buildChecksum(profile: ReviewerArchetypeProfile): string {
  return [
    profile.archetype,
    profile.declaredCohortId,
    profile.behaviorCohortId,
    profile.tagAlignment,
    profile.ratingAlignment
  ].join(':');
}

export function chooseReviewerArchetype(startIndex: number, index: number): ReviewerArchetype {
  return REVIEWER_ARCHETYPES[(startIndex + index) % REVIEWER_ARCHETYPES.length];
}

export function buildReviewerArchetypeProfile(
  cohorts: readonly CohortAnchor[],
  index: number,
  archetype: ReviewerArchetype
): ReviewerArchetypeProfile {
  const seedCohortId = chooseCohortId(cohorts, index);
  const alternateCohortId = chooseCohortId(cohorts, index + 1);

  const profile: ReviewerArchetypeProfile = {
    archetype,
    declaredCohortId: seedCohortId,
    behaviorCohortId: seedCohortId,
    tagAlignment: 8,
    ratingAlignment: 8,
    checksum: ''
  };

  switch (archetype) {
    case 'CLEAN_COHORT_MATCH':
      profile.tagAlignment = 10;
      profile.ratingAlignment = 10;
      break;
    case 'MISLABELED_USER':
      profile.tagAlignment = 10;
      profile.ratingAlignment = 10;
      profile.declaredCohortId = alternateCohortId;
      profile.behaviorCohortId = seedCohortId;
      break;
    case 'INVERSE_RATER':
      profile.tagAlignment = 10;
      profile.ratingAlignment = 0;
      break;
    case 'RANDOM_NOISY_USER':
      profile.tagAlignment = 5;
      profile.ratingAlignment = 5;
      break;
    case 'TINA_LIKE_DETACHED_PREDICTOR':
      profile.tagAlignment = 4;
      profile.ratingAlignment = 7;
      break;
    case 'EARLY_SCOUT':
      profile.tagAlignment = 8;
      profile.ratingAlignment = 8;
      break;
    case 'LATE_CONSENSUS_FOLLOWER':
      profile.tagAlignment = 7;
      profile.ratingAlignment = 7;
      break;
    case 'POPULARITY_CHASER':
      profile.tagAlignment = 6;
      profile.ratingAlignment = 7;
      break;
    case 'NICHE_SPECIALIST':
      profile.tagAlignment = 8;
      profile.ratingAlignment = 8;
      break;
    default:
      profile.tagAlignment = 5;
      profile.ratingAlignment = 5;
  }

  profile.checksum = buildChecksum(profile);
  return profile;
}

export function generateReviewerDeclaredTags(
  rng: SeededRng,
  allTags: readonly TagId[],
  cohort: CohortAnchor,
  alignment: number
): TagId[] {
  return generateAlignedTags(rng, allTags, cohort.tags, alignment);
}

function isClassMatch(islandClass: string | undefined, classes: readonly string[]): boolean {
  return islandClass !== undefined && classes.includes(islandClass);
}

function biasedClassRating(
  rng: SeededRng,
  baseRating: Rating | null,
  islandClass: string | undefined,
  positiveClasses: readonly string[],
  negativeClasses: readonly string[] = []
): Rating {
  if (isClassMatch(islandClass, positiveClasses)) {
    return 1;
  }

  if (isClassMatch(islandClass, negativeClasses)) {
    return -1;
  }

  if (baseRating === null) {
    return 0;
  }

  return rng.next() < 0.5 ? baseRating : 0;
}

export function generateReviewerRatings(
  rng: SeededRng,
  islands: readonly Island[],
  cohortRatings: Record<string, Rating | null>,
  archetype: ReviewerArchetype,
  alignment: number
): Record<string, Rating | null> {
  const baseRatings = generateAlignedRatings(rng, islands as Island[], cohortRatings, alignment);

  switch (archetype) {
    case 'CLEAN_COHORT_MATCH':
      return generateAlignedRatings(rng, islands as Island[], cohortRatings, alignment);
    case 'MISLABELED_USER':
      return generateAlignedRatings(rng, islands as Island[], cohortRatings, alignment);
    case 'INVERSE_RATER':
      return generateAlignedRatings(rng, islands as Island[], cohortRatings, alignment);
    case 'RANDOM_NOISY_USER':
      return generateAlignedRatings(rng, islands as Island[], cohortRatings, alignment);
    case 'TINA_LIKE_DETACHED_PREDICTOR':
      return Object.fromEntries(
        islands.map((island) => [
          island.id,
          biasedClassRating(rng, baseRatings[island.id] ?? 0, island.hiddenClass, ['BROAD_HIT', 'NICHE_COHORT'], ['BROAD_DUD'])
        ])
      ) as Record<string, Rating | null>;
    case 'EARLY_SCOUT':
      // The proof-of-concept has no true exposure-age history at generation time.
      // Use under-reviewed-looking island classes as the proxy so the later analyst
      // reports can still exercise the intended recovery behavior.
      return Object.fromEntries(
        islands.map((island) => [
          island.id,
          biasedClassRating(rng, baseRatings[island.id] ?? 0, island.hiddenClass, ['NICHE_COHORT', 'UNDECIDED'], ['BROAD_HIT'])
        ])
      ) as Record<string, Rating | null>;
    case 'LATE_CONSENSUS_FOLLOWER':
      return Object.fromEntries(
        islands.map((island) => [
          island.id,
          biasedClassRating(rng, baseRatings[island.id] ?? 0, island.hiddenClass, ['BROAD_HIT', 'UNDECIDED'], ['NICHE_COHORT'])
        ])
      ) as Record<string, Rating | null>;
    case 'POPULARITY_CHASER':
      return Object.fromEntries(
        islands.map((island) => [
          island.id,
          biasedClassRating(rng, baseRatings[island.id] ?? 0, island.hiddenClass, ['BROAD_HIT'], ['BROAD_DUD'])
        ])
      ) as Record<string, Rating | null>;
    case 'NICHE_SPECIALIST':
      return Object.fromEntries(
        islands.map((island) => [
          island.id,
          biasedClassRating(rng, baseRatings[island.id] ?? 0, island.hiddenClass, ['NICHE_COHORT'], ['BROAD_HIT'])
        ])
      ) as Record<string, Rating | null>;
    default:
      return baseRatings;
  }
}

import type { CohortAnchor, Island, IslandId, MaybeRating, Rating } from '../model/types.js';
import { ratingsToVector } from '../model/vectors.js';
import type { SeededRng } from './seededRandom.js';
import { assertValidAlignment } from './alignmentValidation.js';

function invertRating(rating: Rating): Rating {
  if (rating === 1) {
    return -1;
  }

  if (rating === -1) {
    return 1;
  }

  return 0;
}

function randomRating(rng: SeededRng): Rating {
  const ratings: Rating[] = [-1, 0, 1];
  return ratings[rng.int(ratings.length)];
}

export function generateAlignedRatings(
  rng: SeededRng,
  islands: Island[],
  seedRatings: Record<IslandId, MaybeRating>,
  alignment: number
): Record<IslandId, MaybeRating> {
  assertValidAlignment(alignment);
  const seedVector = ratingsToVector(seedRatings, islands);

  return Object.fromEntries(
    islands.map((island, index) => {
      const seedRating = seedVector[index] ?? null;

      if (alignment === 10) {
        return [island.id, seedRating];
      }

      if (alignment === 0) {
        return [
          island.id,
          seedRating === null ? null : invertRating(seedRating)
        ];
      }

      if (alignment === 5) {
        return [island.id, randomRating(rng)];
      }

      if (alignment > 5) {
        const copyProbability = (alignment - 5) / 5;
        if (rng.next() < copyProbability) {
          return [island.id, seedRating];
        }

        return [island.id, randomRating(rng)];
      }

      const invertProbability = (5 - alignment) / 5;
      if (rng.next() < invertProbability) {
        return [
          island.id,
          seedRating === null ? null : invertRating(seedRating)
        ];
      }

      return [island.id, randomRating(rng)];
    })
  ) as Record<IslandId, MaybeRating>;
}

export function materializeCohortRatings(
  cohorts: CohortAnchor[],
  islands: Island[]
): CohortAnchor[] {
  return cohorts.map((cohort) => ({
    ...cohort,
    ratings: Object.fromEntries(
      islands.map((island) => [
        island.id,
        island.hiddenAppealPattern?.[cohort.id] ?? 0
      ])
    ) as Record<IslandId, MaybeRating>
  }));
}

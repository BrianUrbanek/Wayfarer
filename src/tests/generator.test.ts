import { describe, expect, it } from 'vitest';
import { pearsonCorrelation } from '../model/similarity';
import { ratingsToVector, tagsToVector } from '../model/vectors';
import { DEFAULT_TAGS } from '../data/defaultTags';
import { createDefaultCohorts } from '../data/defaultCohorts';
import { generateColumbusDataset } from '../generator/columbusGenerator';
import { generateAlignedRatings } from '../generator/ratingGeneration';
import { generateAlignedTags } from '../generator/tagGeneration';
import { createSeededRandom } from '../generator/seededRandom';
import type { GeneratorConfig } from '../generator/columbusGenerator';
import type { Island } from '../model/types';

function makeRatingVector(islands: Island[], ratings: Record<string, -1 | 0 | 1 | null>) {
  return ratingsToVector(ratings, islands);
}

describe('Columbus generator', () => {
  const baseConfig: GeneratorConfig = {
    seed: 1234,
    numUsers: 12,
    numIslands: 18,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 10 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
  };

  it('produces the same dataset for the same seed and config', () => {
    const first = generateColumbusDataset(baseConfig);
    const second = generateColumbusDataset(baseConfig);

    expect(second).toEqual(first);
  });

  it('produces a different dataset for a different seed', () => {
    const first = generateColumbusDataset(baseConfig);
    const second = generateColumbusDataset({ ...baseConfig, seed: 9999 });

    expect(second).not.toEqual(first);
  });

  it('tag alignment 10 produces seed-like tags', () => {
    const dataset = generateColumbusDataset(baseConfig);
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);

    expect(seed).toBeDefined();
    expect(user.declaredTags.sort()).toEqual(seed?.tags.slice().sort());
  });

  it('scenario-level alignment distributions do not degrade clean archetype tag alignment', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      tagAlignmentDistribution: { kind: 'fixed', value: 0 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 0 }
    });
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);

    expect(seed).toBeDefined();
    expect(user.hiddenReviewerArchetype).toBe('CLEAN_COHORT_MATCH');
    expect(user.declaredTags.sort()).toEqual(seed?.tags.slice().sort());
  });

  it('rating alignment 10 strongly matches seed ratings', () => {
    const dataset = generateColumbusDataset(baseConfig);
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);

    expect(seed).toBeDefined();
    const userVector = makeRatingVector(dataset.islands, user.ratings);
    const seedVector = makeRatingVector(dataset.islands, seed?.ratings ?? {});
    const correlation = pearsonCorrelation(userVector, seedVector, 3);

    expect(correlation.value).toBeGreaterThan(0.85);
  });

  it('scenario-level alignment distributions do not degrade clean archetype rating alignment', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      numUsers: 18,
      tagAlignmentDistribution: { kind: 'fixed', value: 0 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 0 }
    });
    const user = dataset.users.find((entry) => entry.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH');
    const seed = dataset.cohorts.find((cohort) => cohort.id === user?.hiddenBehaviorCohortId);

    expect(user).toBeDefined();
    expect(seed).toBeDefined();
    const userVector = makeRatingVector(dataset.islands, user?.ratings ?? {});
    const seedVector = makeRatingVector(dataset.islands, seed?.ratings ?? {});
    const correlation = pearsonCorrelation(userVector, seedVector, 3);

    expect(correlation.value).toBeGreaterThan(0.95);
  });

  it('rating alignment 5 is approximately uncorrelated over enough samples', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      numUsers: 60,
      ratingAlignmentDistribution: { kind: 'fixed', value: 5 },
      tagAlignmentDistribution: { kind: 'fixed', value: 5 }
    });

    const correlations = dataset.users.map((user) => {
      const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
      const userVector = makeRatingVector(dataset.islands, user.ratings);
      const seedVector = makeRatingVector(dataset.islands, seed?.ratings ?? {});

      return pearsonCorrelation(userVector, seedVector, 3).value;
    });

    const average = correlations.reduce((sum, value) => sum + value, 0) / correlations.length;

    expect(Math.abs(average)).toBeLessThan(0.25);
  });

  it('returns users and cohorts that conform to the model types', () => {
    const dataset = generateColumbusDataset(baseConfig);

    expect(dataset.allTags).toEqual(DEFAULT_TAGS);
    expect(dataset.cohorts.length).toBeGreaterThan(0);
    expect(dataset.islands.length).toBeGreaterThan(0);
    expect(dataset.users.length).toBeGreaterThan(0);

    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);

    expect(user.hiddenSeedCohortId).toBeDefined();
    expect(typeof user.hiddenTagAlignment).toBe('number');
    expect(typeof user.hiddenRatingAlignment).toBe('number');
    expect(seed).toBeDefined();
    expect(tagsToVector(user.declaredTags, dataset.allTags)).toHaveLength(dataset.allTags.length);
  });

  it('throws for invalid rating alignment values', () => {
    const rng = createSeededRandom(123);
    const islands = [{ id: 'i-1', label: 'Island 1' }];
    const seedRatings = { 'i-1': 1 as const };
    expect(() => generateAlignedRatings(rng, islands, seedRatings, -1)).toThrow();
    expect(() => generateAlignedRatings(rng, islands, seedRatings, 11)).toThrow();
    expect(() => generateAlignedRatings(rng, islands, seedRatings, 7.5)).toThrow();
    expect(() => generateAlignedRatings(rng, islands, seedRatings, Number.NaN)).toThrow();
  });

  it('throws for invalid tag alignment values', () => {
    const rng = createSeededRandom(456);
    expect(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], -1)).toThrow();
    expect(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], 11)).toThrow();
    expect(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], 7.5)).toThrow();
    expect(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], Number.NaN)).toThrow();
  });
});

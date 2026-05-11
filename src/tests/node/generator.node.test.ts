import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { pearsonCorrelation } from '../../model/similarity.js';
import { ratingsToVector, tagsToVector } from '../../model/vectors.js';
import type { Island, MaybeRating } from '../../model/types.js';
import type { GeneratorConfig } from '../../generator/columbusGenerator.js';

function makeRatingVector(islands: Island[], ratings: Record<string, MaybeRating>) {
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

  it('is reproducible for the same config and seed', () => {
    const first = generateColumbusDataset(baseConfig);
    const second = generateColumbusDataset(baseConfig);
    assert.deepEqual(second, first);
  });

  it('differs for a different seed', () => {
    const first = generateColumbusDataset(baseConfig);
    const second = generateColumbusDataset({ ...baseConfig, seed: 9999 });
    assert.notDeepEqual(second, first);
  });

  it('alignment 10 yields seed-like tags', () => {
    const dataset = generateColumbusDataset(baseConfig);
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
    assert.ok(seed);
    assert.deepEqual([...user.declaredTags].sort(), [...seed.tags].sort());
  });

  it('alignment 0 avoids seed tags as much as possible', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      tagAlignmentDistribution: { kind: 'fixed', value: 0 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
    });
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
    assert.ok(seed);
    const overlap = user.declaredTags.filter((tag) => seed.tags.includes(tag)).length;
    assert.equal(overlap, 0);
  });

  it('alignment 10 strongly matches seed ratings', () => {
    const dataset = generateColumbusDataset(baseConfig);
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
    assert.ok(seed);
    const userVector = makeRatingVector(dataset.islands, user.ratings);
    const seedVector = makeRatingVector(dataset.islands, seed.ratings);
    const result = pearsonCorrelation(userVector, seedVector, 3);
    assert.ok(result.value > 0.85);
  });

  it('alignment 0 strongly anti-correlates with seed ratings', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      ratingAlignmentDistribution: { kind: 'fixed', value: 0 }
    });
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
    assert.ok(seed);
    const userVector = makeRatingVector(dataset.islands, user.ratings);
    const seedVector = makeRatingVector(dataset.islands, seed.ratings);
    const result = pearsonCorrelation(userVector, seedVector, 3);
    assert.ok(result.value < -0.85);
  });

  it('alignment 5 is approximately uncorrelated on average', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      numUsers: 60,
      ratingAlignmentDistribution: { kind: 'fixed', value: 5 },
      tagAlignmentDistribution: { kind: 'fixed', value: 5 }
    });

    const values = dataset.users.map((user) => {
      const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
      assert.ok(seed);
      const userVector = makeRatingVector(dataset.islands, user.ratings);
      const seedVector = makeRatingVector(dataset.islands, seed.ratings);
      return pearsonCorrelation(userVector, seedVector, 3).value;
    });

    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    assert.ok(Math.abs(average) < 0.25);
  });

  it('conforms to the expected model types', () => {
    const dataset = generateColumbusDataset(baseConfig);
    assert.deepEqual(dataset.allTags, DEFAULT_TAGS);
    assert.ok(dataset.cohorts.length > 0);
    assert.ok(dataset.islands.length > 0);
    assert.ok(dataset.users.length > 0);
    const user = dataset.users[0];
    assert.equal(typeof user.hiddenTagAlignment, 'number');
    assert.equal(typeof user.hiddenRatingAlignment, 'number');
    assert.equal(tagsToVector(user.declaredTags, dataset.allTags).length, dataset.allTags.length);
  });
});

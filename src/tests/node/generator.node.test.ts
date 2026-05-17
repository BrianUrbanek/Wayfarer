import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { generateAlignedRatings } from '../../generator/ratingGeneration.js';
import { generateAlignedTags } from '../../generator/tagGeneration.js';
import { createSeededRandom } from '../../generator/seededRandom.js';
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

  it('scenario-level alignment distributions do not degrade clean archetype tag alignment', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      tagAlignmentDistribution: { kind: 'fixed', value: 0 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 0 }
    });
    const user = dataset.users[0];
    const seed = dataset.cohorts.find((cohort) => cohort.id === user.hiddenSeedCohortId);
    assert.ok(seed);
    assert.equal(user.hiddenReviewerArchetype, 'CLEAN_COHORT_MATCH');
    assert.deepEqual([...user.declaredTags].sort(), [...seed.tags].sort());
  });

  it('clean cohort match ratings exactly equal hidden behavior cohort ratings', () => {
    const dataset = generateColumbusDataset(baseConfig);
    const clean = dataset.users.find((user) => user.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH');
    const target = dataset.cohorts.find((cohort) => cohort.id === clean?.hiddenBehaviorCohortId);
    assert.ok(clean);
    assert.ok(target);
    assert.deepEqual(clean.ratings, target.ratings);
    assert.equal(clean.hiddenTagAlignment, 10);
    assert.equal(clean.hiddenRatingAlignment, 10);
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
    assert.ok(user);
    assert.ok(seed);
    const userVector = makeRatingVector(dataset.islands, user.ratings);
    const seedVector = makeRatingVector(dataset.islands, seed.ratings);
    const result = pearsonCorrelation(userVector, seedVector, 3);
    assert.ok(result.value > 0.95);
  });

  it('mixed archetype populations stay around neutral average seed correlation over enough samples', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      numUsers: 60
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

  it('clean cohort archetype preserves strong behavior alignment at high rating alignment', () => {
    const dataset = generateColumbusDataset({ ...baseConfig, numUsers: 18, ratingAlignmentDistribution: { kind: 'fixed', value: 10 } });
    const clean = dataset.users.find((user) => user.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH');
    assert.ok(clean);
    const targetId = clean?.hiddenBehaviorCohortId ?? clean?.hiddenSeedCohortId;
    const target = dataset.cohorts.find((cohort) => cohort.id === targetId);
    assert.ok(target);
    const userVector = makeRatingVector(dataset.islands, clean?.ratings ?? {});
    const targetVector = makeRatingVector(dataset.islands, target?.ratings ?? {});
    const result = pearsonCorrelation(userVector, targetVector, 3);
    assert.ok(result.value > 0.75);
  });

  it('throws for invalid rating alignment values', () => {
    const rng = createSeededRandom(123);
    const islands = [{ id: 'i-1', label: 'Island 1' }];
    const seedRatings = { 'i-1': 1 as const };
    assert.throws(() => generateAlignedRatings(rng, islands, seedRatings, -1));
    assert.throws(() => generateAlignedRatings(rng, islands, seedRatings, 11));
    assert.throws(() => generateAlignedRatings(rng, islands, seedRatings, 7.5));
    assert.throws(() => generateAlignedRatings(rng, islands, seedRatings, Number.NaN));
  });

  it('throws for invalid tag alignment values', () => {
    const rng = createSeededRandom(456);
    assert.throws(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], -1));
    assert.throws(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], 11));
    assert.throws(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], 7.5));
    assert.throws(() => generateAlignedTags(rng, DEFAULT_TAGS, ['strategy', 'competition'], Number.NaN));
  });

  it('legacy scenario alignment config is ignored even when set to hostile fixed-zero values', () => {
    const dataset = generateColumbusDataset({
      ...baseConfig,
      numUsers: 18,
      tagAlignmentDistribution: { kind: 'fixed', value: 0 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 0 }
    });
    const clean = dataset.users.find((user) => user.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH');
    const target = dataset.cohorts.find((cohort) => cohort.id === clean?.hiddenBehaviorCohortId);
    assert.ok(clean);
    assert.ok(target);
    assert.deepEqual(clean.ratings, target.ratings);
    assert.deepEqual([...clean.declaredTags].sort(), [...target.tags].sort());
    assert.equal(clean.hiddenTagAlignment, 10);
    assert.equal(clean.hiddenRatingAlignment, 10);
  });
});

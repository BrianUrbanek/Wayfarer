import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateHiddenTasteCohorts, buildIslandTruth, scoreHiddenTasteFit } from '../../generator/hiddenTasteGeneration.js';
import { createSeededRandom } from '../../generator/seededRandom.js';
import type { SeededRng } from '../../generator/seededRandom.js';

function fakeRng(nextValues: number[], intValues: number[] = []) {
  let nextIndex = 0;
  let intIndex = 0;
  return {
    next() {
      return nextValues[nextIndex++] ?? nextValues[nextValues.length - 1] ?? 0;
    },
    int(max: number) {
      const value = intValues[intIndex++] ?? 0;
      return Math.max(0, Math.min(max - 1, value));
    }
  } as SeededRng;
}

describe('hidden taste generation', () => {
  it('builds a 2N hidden cohort truth set with stable seed and unseeded halves', () => {
    const seedCohorts = createDefaultCohorts();
    const rng = createSeededRandom(12345);
    const result = generateHiddenTasteCohorts(rng, seedCohorts, DEFAULT_TAGS);

    assert.equal(result.hiddenTasteCohorts.length, seedCohorts.length * 2);
    assert.deepEqual(
      result.hiddenTasteCohorts.slice(0, seedCohorts.length).map((cohort) => cohort.kind),
      Array.from({ length: seedCohorts.length }, () => 'seed')
    );
    assert.deepEqual(
      result.hiddenTasteCohorts.slice(seedCohorts.length).map((cohort) => cohort.kind),
      Array.from({ length: seedCohorts.length }, () => 'unseeded')
    );
    assert.ok(result.hiddenTasteCohorts.slice(seedCohorts.length).every((cohort) => cohort.tagSignature.length > 0));
  });

  it('derives deterministic island truth with appeal vectors and truth class', () => {
    const seedCohorts = createDefaultCohorts();
    const rng = createSeededRandom(99);
    const hiddenTasteCohorts = generateHiddenTasteCohorts(rng, seedCohorts, DEFAULT_TAGS).hiddenTasteCohorts;
    const island = { id: 'island-1', label: 'Island 1' };

    const first = buildIslandTruth(createSeededRandom(42), island, hiddenTasteCohorts, DEFAULT_TAGS, 0);
    const second = buildIslandTruth(createSeededRandom(42), island, hiddenTasteCohorts, DEFAULT_TAGS, 0);

    assert.deepEqual(first, second);
    assert.ok(Object.values(first.hiddenAppealVector).some((value) => value !== 0));
    assert.ok(first.hiddenTruthClass === 'seed-cohort-match' || first.hiddenTruthClass === 'unseeded-cohort-match' || first.hiddenTruthClass === 'random');
  });

  it('stamps targeted cohort tags at +1 and keeps random appeal values discrete', () => {
    const seedCohorts = createDefaultCohorts();
    const hiddenTasteCohorts = generateHiddenTasteCohorts(createSeededRandom(19), seedCohorts, DEFAULT_TAGS).hiddenTasteCohorts;
    const target = hiddenTasteCohorts.find((cohort) => cohort.kind === 'seed');
    assert.ok(target);

    const targeted = buildIslandTruth(
      fakeRng([0.1], Array.from({ length: DEFAULT_TAGS.length }, (_, index) => index % 3)),
      { id: 'targeted-island', label: 'Targeted Island' },
      hiddenTasteCohorts,
      DEFAULT_TAGS,
      0
    );

    for (const tag of target.tagSignature) {
      assert.equal(targeted.hiddenAppealVector[tag], 1);
    }
    for (const value of Object.values(targeted.hiddenAppealVector)) {
      assert.ok([-1, 0, 1].includes(value));
    }

    const randomTruth = buildIslandTruth(
      fakeRng([0.95], Array.from({ length: DEFAULT_TAGS.length }, (_, index) => index % 3)),
      { id: 'random-island', label: 'Random Island' },
      hiddenTasteCohorts,
      DEFAULT_TAGS,
      1
    );

    for (const value of Object.values(randomTruth.hiddenAppealVector)) {
      assert.ok([-1, 0, 1].includes(value));
    }
  });

  it('produces a measurable fit score from hidden preference and appeal vectors', () => {
    const seedCohorts = createDefaultCohorts();
    const hiddenTasteCohorts = generateHiddenTasteCohorts(createSeededRandom(7), seedCohorts, DEFAULT_TAGS).hiddenTasteCohorts;
    const tasteCohort = hiddenTasteCohorts[0];
    const islandTruth = buildIslandTruth(createSeededRandom(11), { id: 'island-fit', label: 'Island Fit' }, hiddenTasteCohorts, DEFAULT_TAGS, 1);

    const fit = scoreHiddenTasteFit(tasteCohort.preferenceVector, islandTruth.hiddenAppealVector);

    assert.equal(typeof fit, 'number');
    assert.ok(Number.isFinite(fit));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, evidenceFromOverlap, pearsonCorrelation } from '../../model/similarity.js';
import { ratingsToVector, tagsToVector } from '../../model/vectors.js';
import type { Island, MaybeRating } from '../../model/types.js';

describe('similarity helpers', () => {
  it('maps tags to a binary vector', () => {
    assert.deepEqual(tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']), [
      1,
      1,
      0
    ]);
  });

  it('preserves null ratings', () => {
    const islands: Island[] = [
      { id: 'i-1', label: 'Island One' },
      { id: 'i-2', label: 'Island Two' }
    ];

    assert.deepEqual(ratingsToVector({ 'i-1': 0 }, islands), [0, null]);
  });

  it('cosine exact match returns 1', () => {
    const vector = tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']);
    assert.ok(Math.abs(cosineSimilarity(vector, vector) - 1) < 1e-12);
  });

  it('cosine no-overlap returns 0', () => {
    const a = tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']);
    const b = tagsToVector(['social'], ['skill', 'roleplay', 'social']);
    assert.equal(cosineSimilarity(a, b), 0);
  });

  it('pearson exact match returns near 1', () => {
    const ratings: MaybeRating[] = [1, 0, -1, 1];
    const result = pearsonCorrelation(ratings, ratings);
    assert.ok(result.value > 0.999999);
    assert.equal(result.overlapCount, 4);
  });

  it('pearson inverse match returns near -1', () => {
    const left: MaybeRating[] = [1, 0, -1, 1];
    const right: MaybeRating[] = [-1, 0, 1, -1];
    const result = pearsonCorrelation(left, right);
    assert.ok(result.value < -0.999999);
    assert.equal(result.overlapCount, 4);
  });

  it('pearson ignores null values', () => {
    const left: MaybeRating[] = [1, null, -1, 0];
    const right: MaybeRating[] = [1, 1, -1, 0];
    const result = pearsonCorrelation(left, right);
    assert.equal(result.overlapCount, 3);
    assert.ok(result.value > 0.999999);
  });

  it('pearson returns zero evidence below threshold', () => {
    const left: MaybeRating[] = [1, 0, null];
    const right: MaybeRating[] = [1, 0, 1];
    const result = pearsonCorrelation(left, right, 3);
    assert.equal(result.overlapCount, 2);
    assert.equal(result.evidence, 0);
    assert.equal(result.value, 0);
  });

  it('evidenceFromOverlap saturates predictably', () => {
    assert.equal(evidenceFromOverlap(0), 0);
    assert.ok(Math.abs(evidenceFromOverlap(20) - 0.5) < 1e-10);
  });
});

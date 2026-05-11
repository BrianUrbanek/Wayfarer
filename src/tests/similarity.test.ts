import { describe, expect, it } from 'vitest';
import { cosineSimilarity, evidenceFromOverlap, pearsonCorrelation } from '../model/similarity';
import { ratingsToVector, tagsToVector } from '../model/vectors';
import type { Island, MaybeRating } from '../model/types';

describe('vector helpers', () => {
  it('maps tags into a binary vector over the global tag list', () => {
    const vector = tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']);

    expect(vector).toEqual([1, 1, 0]);
  });

  it('preserves null ratings without collapsing them to meh', () => {
    const islands: Island[] = [
      { id: 'i-1', label: 'Island One' },
      { id: 'i-2', label: 'Island Two' }
    ];

    const vector = ratingsToVector({ 'i-1': 0 }, islands);

    expect(vector).toEqual([0, null]);
  });
});

describe('similarity functions', () => {
  it('cosine exact match returns 1', () => {
    const vector = tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']);

    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 10);
  });

  it('cosine no-overlap binary tags returns 0', () => {
    const a = tagsToVector(['skill', 'roleplay'], ['skill', 'roleplay', 'social']);
    const b = tagsToVector(['social'], ['skill', 'roleplay', 'social']);

    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('Pearson exact rating match returns near 1', () => {
    const ratings: MaybeRating[] = [1, 0, -1, 1];

    const result = pearsonCorrelation(ratings, ratings);

    expect(result.value).toBeCloseTo(1, 10);
    expect(result.overlapCount).toBe(4);
    expect(result.evidence).toBeGreaterThan(0);
  });

  it('Pearson inverse rating match returns near -1', () => {
    const left: MaybeRating[] = [1, 0, -1, 1];
    const right: MaybeRating[] = [-1, 0, 1, -1];
    const result = pearsonCorrelation(left, right);

    expect(result.value).toBeCloseTo(-1, 10);
    expect(result.overlapCount).toBe(4);
  });

  it('Pearson ignores null values', () => {
    const left: MaybeRating[] = [1, null, -1, 0];
    const right: MaybeRating[] = [1, 1, -1, 0];
    const result = pearsonCorrelation(left, right);

    expect(result.overlapCount).toBe(3);
    expect(result.value).toBeCloseTo(1, 10);
  });

  it('Pearson returns zero evidence when overlap is below threshold', () => {
    const left: MaybeRating[] = [1, 0, null];
    const right: MaybeRating[] = [1, 0, 1];
    const result = pearsonCorrelation(left, right, 3);

    expect(result.overlapCount).toBe(2);
    expect(result.evidence).toBe(0);
    expect(result.value).toBe(0);
  });

  it('evidenceFromOverlap saturates predictably', () => {
    expect(evidenceFromOverlap(0)).toBe(0);
    expect(evidenceFromOverlap(20)).toBeCloseTo(0.5, 10);
  });
});

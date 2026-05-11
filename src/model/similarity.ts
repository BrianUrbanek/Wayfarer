import type { MaybeRating, SimilarityResult } from './types.js';

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;

    dot += aValue * bValue;
    normA += aValue * aValue;
    normB += bValue * bValue;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

export function evidenceFromOverlap(overlap: number, k = 20): number {
  if (overlap <= 0) {
    return 0;
  }

  const safeK = Math.max(0, k);

  return overlap / (overlap + safeK);
}

export function pearsonCorrelation(
  a: readonly MaybeRating[],
  b: readonly MaybeRating[],
  minOverlap = 3
): SimilarityResult {
  const length = Math.max(a.length, b.length);
  let overlapCount = 0;
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;

  for (let index = 0; index < length; index += 1) {
    const aValue = a[index];
    const bValue = b[index];

    if (aValue === null || bValue === null || aValue === undefined || bValue === undefined) {
      continue;
    }

    overlapCount += 1;
    sumA += aValue;
    sumB += bValue;
    sumAA += aValue * aValue;
    sumBB += bValue * bValue;
    sumAB += aValue * bValue;
  }

  if (overlapCount < minOverlap) {
    return {
      value: 0,
      evidence: 0,
      overlapCount
    };
  }

  const n = overlapCount;
  const numerator = n * sumAB - sumA * sumB;
  const denominatorLeft = n * sumAA - sumA * sumA;
  const denominatorRight = n * sumBB - sumB * sumB;
  const denominator = Math.sqrt(denominatorLeft * denominatorRight);

  if (denominator === 0) {
    return {
      value: 0,
      evidence: evidenceFromOverlap(overlapCount),
      overlapCount
    };
  }

  const rawValue = numerator / denominator;
  const value = Math.max(-1, Math.min(1, rawValue));

  return {
    value,
    evidence: evidenceFromOverlap(overlapCount),
    overlapCount
  };
}

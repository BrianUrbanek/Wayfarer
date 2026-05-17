import type { CohortAnchor, TagId } from '../model/types.js';
import type { SeededRng } from './seededRandom.js';
import { assertValidAlignment } from './alignmentValidation.js';

function uniqueSample<T>(values: readonly T[], count: number, rng: SeededRng): T[] {
  if (count <= 0 || values.length === 0) {
    return [];
  }

  const shuffled = rng.shuffle(values);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function antiSeedPool(allTags: readonly TagId[], seedTags: readonly TagId[]): TagId[] {
  const seedSet = new Set(seedTags);
  return allTags.filter((tag) => !seedSet.has(tag));
}

function targetTagCount(seedTags: readonly TagId[], allTags: readonly TagId[]): number {
  return Math.max(1, Math.min(seedTags.length || 1, allTags.length));
}

function sampleRandomTags(rng: SeededRng, allTags: readonly TagId[], count: number): TagId[] {
  return uniqueSample(allTags, count, rng);
}

function sampleAntiSeedTags(
  rng: SeededRng,
  allTags: readonly TagId[],
  seedTags: readonly TagId[],
  count: number
): TagId[] {
  const antiPool = antiSeedPool(allTags, seedTags);

  if (antiPool.length >= count) {
    return uniqueSample(antiPool, count, rng);
  }

  const selected = uniqueSample(antiPool, antiPool.length, rng);
  const remaining = allTags.filter((tag) => !selected.includes(tag));
  return selected.concat(uniqueSample(remaining, count - selected.length, rng));
}

function sampleSeedLikeTags(
  rng: SeededRng,
  allTags: readonly TagId[],
  seedTags: readonly TagId[],
  count: number
): TagId[] {
  const selected = uniqueSample(seedTags, Math.min(count, seedTags.length), rng);
  if (selected.length >= count) {
    return selected;
  }

  const remaining = allTags.filter((tag) => !selected.includes(tag));
  return selected.concat(uniqueSample(remaining, count - selected.length, rng));
}

export function generateAlignedTags(
  rng: SeededRng,
  allTags: readonly TagId[],
  seedTags: readonly TagId[],
  alignment: number
): TagId[] {
  assertValidAlignment(alignment);
  const count = targetTagCount(seedTags, allTags);

  if (alignment === 10) {
    return seedTags.slice(0, count);
  }

  if (alignment === 5) {
    return sampleRandomTags(rng, allTags, count);
  }

  if (alignment === 0) {
    return sampleAntiSeedTags(rng, allTags, seedTags, count);
  }

  if (alignment > 5) {
    const seedPortion = (alignment - 5) / 5;
    const seedCount = Math.min(count, Math.max(0, Math.round(seedPortion * count)));
    const seedPart = sampleSeedLikeTags(rng, allTags, seedTags, seedCount);
    const remaining = allTags.filter((tag) => !seedPart.includes(tag));
    return seedPart.concat(uniqueSample(remaining, count - seedPart.length, rng));
  }

  const antiPortion = (5 - alignment) / 5;
  const antiCount = Math.min(count, Math.max(0, Math.round(antiPortion * count)));
  const antiPart = sampleAntiSeedTags(rng, allTags, seedTags, antiCount);
  const remaining = allTags.filter((tag) => !antiPart.includes(tag));
  return antiPart.concat(uniqueSample(remaining, count - antiPart.length, rng));
}

export function generateSeedLikeUserTags(
  rng: SeededRng,
  allTags: readonly TagId[],
  cohort: CohortAnchor,
  alignment: number
): TagId[] {
  return generateAlignedTags(rng, allTags, cohort.tags, alignment);
}

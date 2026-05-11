import { describe, expect, it } from 'vitest';
import { generateColumbusDataset } from '../generator/columbusGenerator';
import { DEFAULT_TAGS } from '../data/defaultTags';
import { createDefaultCohorts } from '../data/defaultCohorts';
import {
  computeInference,
  computeDeclaredSimilarities,
  computeBehavioralSimilarities,
  computeInverseBehavioralSimilarities,
  computeDeclaredDistribution,
  computeBehaviorDistribution,
  computeInverseBehaviorDistribution,
  computeEffectiveSignal,
  topCohortMatch
} from '../model/inference';
import type { CohortAnchor, Island, MaybeRating, User } from '../model/types';

function buildDataset() {
  return generateColumbusDataset({
    seed: 20240510,
    numUsers: 10,
    numIslands: 18,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 10 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
  });
}

function buildVisibleUser(
  label: string,
  declaredTags: string[],
  ratings: Record<string, MaybeRating>,
  hiddenSeedCohortId?: string
): User {
  return {
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    declaredTags,
    ratings,
    hiddenSeedCohortId
  };
}

function ratingVectorFromCohort(islands: Island[], cohort: CohortAnchor): Record<string, MaybeRating> {
  return Object.fromEntries(islands.map((island) => [island.id, cohort.ratings[island.id] ?? null]));
}

describe('inference pipeline', () => {
  const dataset = buildDataset();
  const [cohortA, cohortB, cohortC] = dataset.cohorts;

  it('computes the declared and behavioral top matches for Cohort A', () => {
    const user = buildVisibleUser(
      'Cohort A user',
      cohortA.tags,
      ratingVectorFromCohort(dataset.islands, cohortA)
    );

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortA.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortA.id);
    expect(inference.diagnosis.type).toBe('HIGH_SIGNAL');
    expect(inference.effectiveSignal).toBeGreaterThanOrEqual(0.75);
  });

  it('flags a declared Cohort A user whose ratings match Cohort B as a retag mismatch', () => {
    const user = buildVisibleUser(
      'Mismatch user',
      cohortA.tags,
      ratingVectorFromCohort(dataset.islands, cohortB)
    );

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortA.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortB.id);
    expect(inference.diagnosis.type).toBe('MISMATCH_RETAG');
    expect(inference.diagnosis.suggestedCohortId).toBe(cohortB.id);
  });

  it('ignores the hidden seed when visible tags and ratings match Cohort B', () => {
    const visibleMatch = buildVisibleUser(
      'Visible B user',
      cohortB.tags,
      ratingVectorFromCohort(dataset.islands, cohortB),
      cohortA.id
    );

    const inference = computeInference(visibleMatch, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortB.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortB.id);
    expect(inference.diagnosis.type).toBe('HIGH_SIGNAL');
  });

  it('recognizes a strongly inverted rating profile', () => {
    const invertedRatings = Object.fromEntries(
      dataset.islands.map((island) => {
        const rating = cohortA.ratings[island.id] ?? null;
        const inverted: MaybeRating = rating === 1 ? -1 : rating === -1 ? 1 : 0;
        return [island.id, inverted];
      })
    );
    const user = buildVisibleUser('Inverse user', cohortA.tags, invertedRatings);

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.inverseBehaviorDistribution).cohortId).toBe(cohortA.id);
    expect(inference.diagnosis.type).toBe('INVERSE_PROFILE');
  });

  it('treats random visible ratings as unknown or ambiguous', () => {
    const randomRatings = Object.fromEntries(
      dataset.islands.map((island, index) => {
        const pattern: MaybeRating[] = [1, 0, -1, null];
        return [island.id, pattern[index % pattern.length]];
      })
    );
    const user = buildVisibleUser('Random user', cohortC.tags, randomRatings);

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(['UNKNOWN_OR_NOISY', 'AMBIGUOUS']).toContain(inference.diagnosis.type);
  });

  it('keeps blended A/B users medium-to-high signal without forcing a single cohort', () => {
    const blendedTags = cohortA.tags.slice(0, 2).concat(cohortB.tags.slice(0, 2));
    const blendedRatings = Object.fromEntries(
      dataset.islands.map((island, index) => {
        const cohort = index % 2 === 0 ? cohortA : cohortB;
        return [island.id, cohort.ratings[island.id] ?? null];
      })
    );
    const user = buildVisibleUser('Blended user', blendedTags, blendedRatings);

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(inference.effectiveSignal).toBeGreaterThan(0.5);
    expect(inference.declaredTop.score).toBeLessThan(0.8);
    expect(inference.behaviorTop.score).toBeLessThan(0.8);
    expect(['HIGH_SIGNAL', 'AMBIGUOUS']).toContain(inference.diagnosis.type);
  });

  it('exposes intermediate similarity and distribution helpers', () => {
    const user = buildVisibleUser(
      'Helper user',
      cohortA.tags,
      ratingVectorFromCohort(dataset.islands, cohortA)
    );

    const declaredSimilarities = computeDeclaredSimilarities(user, dataset.cohorts, dataset.allTags);
    const behavioralSimilarities = computeBehavioralSimilarities(user, dataset.cohorts, dataset.islands);
    const inverseBehavioralSimilarities = computeInverseBehavioralSimilarities(
      behavioralSimilarities
    );
    const declaredDistribution = computeDeclaredDistribution(declaredSimilarities);
    const behaviorDistribution = computeBehaviorDistribution(behavioralSimilarities);
    const inverseBehaviorDistribution = computeInverseBehaviorDistribution(
      inverseBehavioralSimilarities
    );
    const signal = computeEffectiveSignal(declaredDistribution, behaviorDistribution, {
      declaredEvidence: 1,
      behavioralEvidence: 1
    });

    expect(declaredSimilarities).toHaveLength(dataset.cohorts.length);
    expect(behavioralSimilarities).toHaveLength(dataset.cohorts.length);
    expect(inverseBehavioralSimilarities).toHaveLength(dataset.cohorts.length);
    expect(declaredDistribution).toHaveLength(dataset.cohorts.length);
    expect(behaviorDistribution).toHaveLength(dataset.cohorts.length);
    expect(inverseBehaviorDistribution).toHaveLength(dataset.cohorts.length);
    expect(signal.signalFit).toBeGreaterThan(0.9);
  });
});

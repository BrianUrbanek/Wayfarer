import { describe, expect, it } from 'vitest';
import {
  computeBehaviorDistribution,
  computeBehavioralSimilarities,
  computeDeclaredDistribution,
  computeDeclaredSimilarities,
  computeEffectiveSignal,
  computeInference,
  computeInverseBehaviorDistribution,
  computeInverseBehavioralSimilarities,
  topCohortMatch
} from '../model/inference';
import type { CohortAnchor, Island, MaybeRating, User } from '../model/types';

function buildFixture() {
  const islands: Island[] = [
    { id: 'i-1', label: 'Island 1' },
    { id: 'i-2', label: 'Island 2' },
    { id: 'i-3', label: 'Island 3' },
    { id: 'i-4', label: 'Island 4' }
  ];

  const cohorts: CohortAnchor[] = [
    {
      id: 'cohort-a',
      label: 'Cohort A',
      tags: ['alpha', 'beta'],
      ratings: {
        'i-1': 1,
        'i-2': 1,
        'i-3': -1,
        'i-4': -1
      },
      source: 'meta_moderator'
    },
    {
      id: 'cohort-b',
      label: 'Cohort B',
      tags: ['gamma', 'delta'],
      ratings: {
        'i-1': -1,
        'i-2': -1,
        'i-3': 1,
        'i-4': 1
      },
      source: 'meta_moderator'
    },
    {
      id: 'cohort-c',
      label: 'Cohort C',
      tags: ['epsilon', 'zeta'],
      ratings: {
        'i-1': 0,
        'i-2': 0,
        'i-3': 0,
        'i-4': 0
      },
      source: 'meta_moderator'
    }
  ];

  return {
    allTags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'],
    cohorts,
    islands
  };
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

function ratingVectorFromCohort(cohort: CohortAnchor): Record<string, MaybeRating> {
  return { ...cohort.ratings };
}

describe('inference pipeline', () => {
  const dataset = buildFixture();
  const [cohortA, cohortB, cohortC] = dataset.cohorts;

  it('matches Cohort A when tags and ratings both align', () => {
    const user = buildVisibleUser('Cohort A user', cohortA.tags, ratingVectorFromCohort(cohortA));

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortA.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortA.id);
    expect(inference.diagnosis.type).toBe('HIGH_SIGNAL');
    expect(inference.effectiveSignal).toBeGreaterThanOrEqual(0.75);
  });

  it('prefers retag mismatch when declared and behavioral top cohorts differ', () => {
    const user = buildVisibleUser('Mismatch user', cohortA.tags, ratingVectorFromCohort(cohortB));

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortA.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortB.id);
    expect(inference.diagnosis.type).toBe('MISMATCH_RETAG');
    expect(inference.diagnosis.suggestedCohortId).toBe(cohortB.id);
  });

  it('keeps visible declared/behavior tops on Cohort B while target-alignment auditing uses hidden reference fallback', () => {
    const visibleMatch = buildVisibleUser(
      'Visible B user',
      cohortB.tags,
      ratingVectorFromCohort(cohortB),
      cohortA.id
    );

    const inference = computeInference(visibleMatch, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(topCohortMatch(inference.declaredDistribution).cohortId).toBe(cohortB.id);
    expect(topCohortMatch(inference.behaviorDistribution).cohortId).toBe(cohortB.id);
    expect(inference.targetAlignment.cohortId).toBe(cohortA.id);
    expect(inference.targetAlignment.agreementRate).toBe(0);
    expect(inference.diagnosis.type).toBe('HIGH_SIGNAL');
  });

  it('recognizes a strongly inverted rating profile', () => {
    const inverseFixture = buildFixture();
    const [inverseA, inverseB, inverseC] = inverseFixture.cohorts;
    inverseB.ratings = {
      'i-1': 0,
      'i-2': 0,
      'i-3': 0,
      'i-4': 0
    };
    inverseC.ratings = {
      'i-1': 0,
      'i-2': 0,
      'i-3': 0,
      'i-4': 0
    };

    const invertedRatings: Record<string, MaybeRating> = Object.fromEntries(
      inverseFixture.islands.map((island) => {
        const rating = inverseA.ratings[island.id] ?? null;
        const inverted: MaybeRating = rating === 1 ? -1 : rating === -1 ? 1 : 0;
        return [island.id, inverted];
      })
    );
    const user = buildVisibleUser('Inverse user', inverseA.tags, invertedRatings);

    const inference = computeInference(
      user,
      inverseFixture.cohorts,
      inverseFixture.allTags,
      inverseFixture.islands
    );

    expect(topCohortMatch(inference.inverseBehaviorDistribution).cohortId).toBe(inverseA.id);
    expect(inference.diagnosis.type).toBe('INVERSE_PROFILE');
  });

  it('treats sparse noisy ratings as unknown or ambiguous', () => {
    const randomRatings: Record<string, MaybeRating> = Object.fromEntries(
      dataset.islands.map((island) => [island.id, null as MaybeRating])
    );
    const user = buildVisibleUser('Random user', cohortC.tags, randomRatings);

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(['UNKNOWN_OR_NOISY', 'AMBIGUOUS']).toContain(inference.diagnosis.type);
  });

  it('keeps blended A/B users medium-to-high signal without forcing a single cohort', () => {
    const blendedTags = cohortA.tags.slice(0, 1).concat(cohortB.tags.slice(0, 1));
    const blendedRatings: Record<string, MaybeRating> = {
      'i-1': 1,
      'i-2': 1,
      'i-3': 1,
      'i-4': -1
    };
    const user = buildVisibleUser('Blended user', blendedTags, blendedRatings);

    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);

    expect(inference.effectiveSignal).toBeGreaterThan(0.5);
    expect(inference.declaredTop.score).toBeLessThan(0.8);
    expect(['UNKNOWN_OR_NOISY', 'LOW_SIGNAL']).not.toContain(inference.diagnosis.type);
  });

  it('exposes intermediate helper outputs', () => {
    const user = buildVisibleUser('Helper user', cohortA.tags, ratingVectorFromCohort(cohortA));

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
    expect(signal.signalFit).toBeGreaterThan(0.8);
  });

  it('keeps high target agreement even when separability is low due to broad consensus', () => {
    const consensusFixture = buildFixture();
    consensusFixture.cohorts.forEach((cohort) => {
      cohort.ratings = {
        'i-1': 1,
        'i-2': 1,
        'i-3': 1,
        'i-4': 1
      };
    });
    const user = buildVisibleUser('Consensus user', ['alpha'], {
      'i-1': 1,
      'i-2': 1,
      'i-3': 1,
      'i-4': 1
    }, consensusFixture.cohorts[0].id);
    user.hiddenBehaviorCohortId = consensusFixture.cohorts[0].id;
    const inference = computeInference(user, consensusFixture.cohorts, consensusFixture.allTags, consensusFixture.islands);
    expect(inference.targetAlignment.agreementRate).toBe(1);
    expect(inference.cohortSeparability.label).toBe('low');
  });
});

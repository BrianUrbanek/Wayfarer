import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
} from '../../model/inference.js';
import type { CohortAnchor, Island, MaybeRating, User } from '../../model/types.js';

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
    assert.equal(topCohortMatch(inference.declaredDistribution).cohortId, cohortA.id);
    assert.equal(topCohortMatch(inference.behaviorDistribution).cohortId, cohortA.id);
    assert.equal(inference.diagnosis.type, 'HIGH_SIGNAL');
    assert.ok(inference.effectiveSignal >= 0.75);
  });

  it('prefers retag mismatch when declared and behavioral top cohorts differ', () => {
    const user = buildVisibleUser('Mismatch user', cohortA.tags, ratingVectorFromCohort(cohortB));
    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);
    assert.equal(topCohortMatch(inference.declaredDistribution).cohortId, cohortA.id);
    assert.equal(topCohortMatch(inference.behaviorDistribution).cohortId, cohortB.id);
    assert.equal(inference.diagnosis.type, 'MISMATCH_RETAG');
    assert.equal(inference.diagnosis.suggestedCohortId, cohortB.id);
  });

  it('keeps visible declared/behavior tops on Cohort B while target-alignment auditing uses hidden reference fallback', () => {
    const visibleMatch = buildVisibleUser(
      'Visible B user',
      cohortB.tags,
      ratingVectorFromCohort(cohortB),
      cohortA.id
    );

    const inference = computeInference(visibleMatch, dataset.cohorts, dataset.allTags, dataset.islands);
    assert.equal(topCohortMatch(inference.declaredDistribution).cohortId, cohortB.id);
    assert.equal(topCohortMatch(inference.behaviorDistribution).cohortId, cohortB.id);
    assert.equal(inference.targetAlignment.cohortId, cohortA.id);
    assert.equal(inference.targetAlignment.agreementRate, 0);
    assert.equal(inference.diagnosis.type, 'HIGH_SIGNAL');
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
    assert.equal(topCohortMatch(inference.inverseBehaviorDistribution).cohortId, inverseA.id);
    assert.equal(inference.diagnosis.type, 'INVERSE_PROFILE');
  });

  it('treats sparse noisy ratings as unknown or ambiguous', () => {
    const randomRatings: Record<string, MaybeRating> = Object.fromEntries(
      dataset.islands.map((island) => [island.id, null as MaybeRating])
    );
    const user = buildVisibleUser('Random user', cohortC.tags, randomRatings);
    const inference = computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands);
    assert.ok(['UNKNOWN_OR_NOISY', 'AMBIGUOUS'].includes(inference.diagnosis.type));
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
    assert.ok(inference.effectiveSignal > 0.5);
    assert.ok(inference.declaredTop.score < 0.8);
    assert.ok(!['UNKNOWN_OR_NOISY', 'LOW_SIGNAL'].includes(inference.diagnosis.type));
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
    assert.equal(declaredSimilarities.length, dataset.cohorts.length);
    assert.equal(behavioralSimilarities.length, dataset.cohorts.length);
    assert.equal(inverseBehavioralSimilarities.length, dataset.cohorts.length);
    assert.equal(declaredDistribution.length, dataset.cohorts.length);
    assert.equal(behaviorDistribution.length, dataset.cohorts.length);
    assert.equal(inverseBehaviorDistribution.length, dataset.cohorts.length);
    assert.ok(signal.signalFit > 0.8);
  });

  it('keeps high target agreement even when separability is low under broad consensus', () => {
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
    assert.equal(inference.targetAlignment.agreementRate, 1);
    assert.equal(inference.cohortSeparability.label, 'low');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIslandAffinityReports, type AffinityRatingEvent } from '../../model/affinity.js';
import { buildRaterSignalProfiles } from '../../model/raterSignal.js';
import {
  recommendIslandsForUser,
  scoreIslandRecommendation
} from '../../model/recommendations.js';
import type { CohortAnchor, Island, MaybeRating, User } from '../../model/types.js';
import { computeInference } from '../../model/inference.js';

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
    }
  ];

  return {
    allTags: ['alpha', 'beta', 'gamma', 'delta'],
    cohorts,
    islands
  };
}

function buildUser(
  id: string,
  label: string,
  declaredTags: string[],
  ratings: Record<string, MaybeRating>
): User {
  return {
    id,
    label,
    declaredTags,
    ratings
  };
}

function buildReports() {
  const fixture = buildFixture();
  const [cohortA] = fixture.cohorts;

  const user = buildUser('user-a', 'User A', cohortA.tags, {
    'i-1': 1,
    'i-2': 1,
    'i-3': -1,
    'i-4': null
  });
  const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
  const signalProfiles = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts);

  const affinityEvents: AffinityRatingEvent[] = [
    { userId: user.id, islandId: 'i-1', rating: 1 },
    { userId: user.id, islandId: 'i-2', rating: 1 },
    { userId: user.id, islandId: 'i-3', rating: -1 }
  ];
  const affinityReports = buildIslandAffinityReports(
    affinityEvents,
    signalProfiles.byUserId,
    fixture.cohorts,
    fixture.islands
  );

  return {
    fixture,
    user,
    signalProfiles,
    affinityReports
  };
}

describe('recommendation scoring', () => {
  it('only includes unrated islands', () => {
    const { fixture, user, signalProfiles, affinityReports } = buildReports();
    const recommendations = recommendIslandsForUser(
      user,
      affinityReports.byIslandId,
      signalProfiles.byUserId,
      fixture.islands,
      { topLimit: 10 }
    );

    assert.equal(recommendations.recommendations.every((entry) => user.ratings[entry.islandId] === null), true);
  });

  it('raises score when predicted fit is stronger', () => {
    const { user, signalProfiles } = buildReports();
    const baseReport = {
      islandId: 'i-5',
      estimates: [
        {
          islandId: 'i-5',
          cohortId: 'cohort-a',
          observedMean: 0.6,
          affinity: 0.6,
          confidence: 0.8,
          disagreement: 0.1,
          rawCount: 5,
          effectiveWeight: 8,
          positiveCount: 4,
          neutralCount: 1,
          negativeCount: 0,
          contributions: []
        },
        {
          islandId: 'i-5',
          cohortId: 'cohort-b',
          observedMean: -0.2,
          affinity: -0.2,
          confidence: 0.4,
          disagreement: 0.2,
          rawCount: 5,
          effectiveWeight: 3,
          positiveCount: 1,
          neutralCount: 1,
          negativeCount: 3,
          contributions: []
        }
      ],
      topPositive: null,
      topNegative: null
    };

    const stronger = scoreIslandRecommendation(
      user,
      { id: 'i-5', label: 'Island 5' },
      baseReport,
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: -1, explorationWeight: 0.5 }
    );

    const weaker = scoreIslandRecommendation(
      user,
      { id: 'i-6', label: 'Island 6' },
      {
        ...baseReport,
        islandId: 'i-6',
        estimates: baseReport.estimates.map((estimate) =>
          estimate.cohortId === 'cohort-a'
            ? { ...estimate, affinity: 0.1, confidence: 0.4, effectiveWeight: 2 }
            : estimate
        )
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: -1, explorationWeight: 0.5 }
    );

    assert.ok((stronger?.predictedFit ?? 0) > (weaker?.predictedFit ?? 0));
    assert.ok((stronger?.recommendationScore ?? 0) > (weaker?.recommendationScore ?? 0));
  });

  it('raises score when discovery value increases and exploration is positive', () => {
    const { user, signalProfiles } = buildReports();
    const lowDiscovery = scoreIslandRecommendation(
      user,
      { id: 'i-7', label: 'Island 7' },
      {
        islandId: 'i-7',
        estimates: [
          {
            islandId: 'i-7',
            cohortId: 'cohort-a',
            observedMean: 0.5,
            affinity: 0.5,
            confidence: 0.9,
            disagreement: 0.1,
            rawCount: 12,
            effectiveWeight: 20,
            positiveCount: 8,
            neutralCount: 2,
            negativeCount: 2,
            contributions: []
          }
        ],
        topPositive: null,
        topNegative: null
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: -1, explorationWeight: 1 }
    );

    const highDiscovery = scoreIslandRecommendation(
      user,
      { id: 'i-8', label: 'Island 8' },
      {
        islandId: 'i-8',
        estimates: [
          {
            islandId: 'i-8',
            cohortId: 'cohort-a',
            observedMean: 0.5,
            affinity: 0.5,
            confidence: 0.1,
            disagreement: 0.5,
            rawCount: 1,
            effectiveWeight: 1,
            positiveCount: 1,
            neutralCount: 0,
            negativeCount: 0,
            contributions: []
          }
        ],
        topPositive: null,
        topNegative: null
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: -1, explorationWeight: 1 }
    );

    assert.ok((highDiscovery?.discoveryValue ?? 0) > (lowDiscovery?.discoveryValue ?? 0));
    assert.ok((highDiscovery?.recommendationScore ?? 0) > (lowDiscovery?.recommendationScore ?? 0));
  });

  it('blocks low-fit discovery spam under the fit floor', () => {
    const { user, signalProfiles } = buildReports();
    const recommendation = scoreIslandRecommendation(
      user,
      { id: 'i-9', label: 'Island 9' },
      {
        islandId: 'i-9',
        estimates: [
          {
            islandId: 'i-9',
            cohortId: 'cohort-a',
            observedMean: 0.05,
            affinity: 0.05,
            confidence: 0.05,
            disagreement: 0.9,
            rawCount: 1,
            effectiveWeight: 1,
            positiveCount: 0,
            neutralCount: 1,
            negativeCount: 0,
            contributions: []
          }
        ],
        topPositive: null,
        topNegative: null
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: 0.2, explorationWeight: 5 }
    );

    assert.equal(recommendation, null);
  });

  it('classifies safe recommendations versus discovery probes', () => {
    const { user, signalProfiles } = buildReports();
    const safe = scoreIslandRecommendation(
      user,
      { id: 'i-10', label: 'Island 10' },
      {
        islandId: 'i-10',
        estimates: [
          {
            islandId: 'i-10',
            cohortId: 'cohort-a',
            observedMean: 0.9,
            affinity: 0.9,
            confidence: 0.9,
            disagreement: 0.05,
            rawCount: 20,
            effectiveWeight: 18,
            positiveCount: 18,
            neutralCount: 1,
            negativeCount: 1,
            contributions: []
          }
        ],
        topPositive: null,
        topNegative: null
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: 0.2, explorationWeight: 0.5 }
    );

    const probe = scoreIslandRecommendation(
      user,
      { id: 'i-11', label: 'Island 11' },
      {
        islandId: 'i-11',
        estimates: [
          {
            islandId: 'i-11',
            cohortId: 'cohort-a',
            observedMean: 0.7,
            affinity: 0.7,
            confidence: 0.2,
            disagreement: 0.6,
            rawCount: 2,
            effectiveWeight: 2,
            positiveCount: 2,
            neutralCount: 0,
            negativeCount: 0,
            contributions: []
          }
        ],
        topPositive: null,
        topNegative: null
      },
      signalProfiles.byUserId.get(user.id),
      { minPredictedFitFloor: 0.2, explorationWeight: 0.5 }
    );

    assert.equal(safe?.recommendationKind, 'SAFE_FIT');
    assert.equal(probe?.recommendationKind, 'DISCOVERY_PROBE');
  });
});

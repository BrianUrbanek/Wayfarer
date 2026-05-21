import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildUserDeprioritizationAnalysis } from '../../model/deprioritization.js';
import type { CohortAnchor, Island, MaybeRating, User } from '../../model/types.js';
import type { IslandAffinityReport } from '../../model/affinity.js';
import type { RaterSignalProfile } from '../../model/raterSignal.js';

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

  return { islands, cohorts };
}

function buildUser(
  id: string,
  label: string,
  declaredTags: string[],
  ratings: Record<string, MaybeRating>
): User {
  return { id, label, declaredTags, ratings };
}

function buildSignalProfile(): RaterSignalProfile {
  return {
    userId: 'user-a',
    overallSignal: 1,
    signalEvidence: 10,
    cohortWeights: {
      'cohort-a': 1,
      'cohort-b': 0
    },
    cohortEvidence: {
      'cohort-a': 10,
      'cohort-b': 0
    },
    cohortSimilarities: {
      'cohort-a': { value: 1, evidence: 10, overlapCount: 4 },
      'cohort-b': { value: 0, evidence: 0, overlapCount: 0 }
    },
    topCohortId: 'cohort-a'
  };
}

describe('deprioritization report', () => {
  it('keeps strong negative weighted fit, excludes positive and rated islands, and sorts deterministically', () => {
    const fixture = buildFixture();
    const [cohortA] = fixture.cohorts;
    const user = buildUser('user-a', 'User A', cohortA.tags, {
      'i-1': 1,
      'i-2': null,
      'i-3': null,
      'i-4': null
    });
    const signalProfile = buildSignalProfile();

    const affinityReports = new Map<string, IslandAffinityReport>([
      [
        'i-1',
        {
          islandId: 'i-1',
          estimates: [
            {
              islandId: 'i-1',
              cohortId: 'cohort-a',
              observedMean: 0.9,
              affinity: 0.9,
              confidence: 0.9,
              disagreement: 0.1,
              rawCount: 8,
              effectiveWeight: 10,
              positiveCount: 8,
              neutralCount: 0,
              negativeCount: 0,
              contributions: []
            }
          ],
          topPositive: null,
          topNegative: null
        }
      ],
      [
        'i-3',
        {
          islandId: 'i-3',
          estimates: [
            {
              islandId: 'i-3',
              cohortId: 'cohort-a',
              observedMean: -0.8,
              affinity: -0.8,
              confidence: 0.9,
              disagreement: 0.1,
              rawCount: 8,
              effectiveWeight: 10,
              positiveCount: 0,
              neutralCount: 0,
              negativeCount: 8,
              contributions: []
            }
          ],
          topPositive: null,
          topNegative: null
        }
      ],
      [
        'i-4',
        {
          islandId: 'i-4',
          estimates: [
            {
              islandId: 'i-4',
              cohortId: 'cohort-a',
              observedMean: -0.9,
              affinity: -0.9,
              confidence: 0.15,
              disagreement: 0.7,
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
        }
      ]
    ]);

    const analysis = buildUserDeprioritizationAnalysis(
      user,
      affinityReports,
      signalProfile,
      fixture.islands,
      { topLimit: 10 }
    );

    assert.equal(analysis.rows.length, 1);
    assert.equal(analysis.rows[0].islandId, 'i-3');
    assert.ok(analysis.rows[0].predictedFit < 0);
    assert.ok(analysis.rows[0].confidenceSupport >= 0.55);
    assert.ok(analysis.rows[0].deprioritizationScore > 0);
  });

  it('is deterministic for equal deprioritization scores', () => {
    const fixture = buildFixture();
    const [cohortA] = fixture.cohorts;
    const user = buildUser('user-b', 'User B', cohortA.tags, {
      'i-1': null,
      'i-2': null,
      'i-3': null,
      'i-4': null
    });
    const signalProfile = buildSignalProfile();

    const affinityReports = new Map<string, IslandAffinityReport>([
      [
        'i-1',
        {
          islandId: 'i-1',
          estimates: [
            {
              islandId: 'i-1',
              cohortId: 'cohort-a',
              observedMean: -0.7,
              affinity: -0.7,
              confidence: 0.9,
              disagreement: 0.1,
              rawCount: 5,
              effectiveWeight: 6,
              positiveCount: 0,
              neutralCount: 0,
              negativeCount: 5,
              contributions: []
            }
          ],
          topPositive: null,
          topNegative: null
        }
      ],
      [
        'i-2',
        {
          islandId: 'i-2',
          estimates: [
            {
              islandId: 'i-2',
              cohortId: 'cohort-a',
              observedMean: -0.7,
              affinity: -0.7,
              confidence: 0.9,
              disagreement: 0.1,
              rawCount: 5,
              effectiveWeight: 6,
              positiveCount: 0,
              neutralCount: 0,
              negativeCount: 5,
              contributions: []
            }
          ],
          topPositive: null,
          topNegative: null
        }
      ]
    ]);

    const analysis = buildUserDeprioritizationAnalysis(
      user,
      affinityReports,
      signalProfile,
      fixture.islands,
      { topLimit: 10 }
    );

    assert.deepEqual(
      analysis.rows.map((row) => row.islandId),
      ['i-1', 'i-2']
    );
  });
});

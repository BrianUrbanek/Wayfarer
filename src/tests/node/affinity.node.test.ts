import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIslandAffinityReports, type AffinityRatingEvent } from '../../model/affinity.js';
import { buildRaterSignalProfiles } from '../../model/raterSignal.js';
import { computeInference } from '../../model/inference.js';
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

describe('weighted island / cohort affinity', () => {
  const fixture = buildFixture();
  const [cohortA, cohortB] = fixture.cohorts;
  const islandX: Island = { id: 'i-5', label: 'Island 5' };
  const islandY: Island = { id: 'i-6', label: 'Island 6' };

  const userA = buildUser('user-a', 'User A', cohortA.tags, { ...cohortA.ratings });
  const userB = buildUser('user-b', 'User B', cohortB.tags, { ...cohortB.ratings });
  const inferenceA = computeInference(userA, fixture.cohorts, fixture.allTags, fixture.islands);
  const inferenceB = computeInference(userB, fixture.cohorts, fixture.allTags, fixture.islands);
  const profiles = buildRaterSignalProfiles(
    [userA, userB],
    new Map([
      [userA.id, inferenceA],
      [userB.id, inferenceB]
    ]),
    fixture.cohorts
  );

  it('weights the same rating differently for different cohort affinities', () => {
    const reports = buildIslandAffinityReports(
      [
        { userId: userA.id, islandId: islandX.id, rating: 1 },
        { userId: userB.id, islandId: islandX.id, rating: 1 }
      ],
      profiles.byUserId,
      fixture.cohorts,
      [...fixture.islands, islandX]
    );

    const report = reports.byIslandId.get(islandX.id);
    const estimateA = report?.estimates.find((entry) => entry.cohortId === cohortA.id);
    const estimateB = report?.estimates.find((entry) => entry.cohortId === cohortB.id);
    const aContributionToA = estimateA?.contributions.find((entry) => entry.userId === userA.id);
    const bContributionToA = estimateA?.contributions.find((entry) => entry.userId === userB.id);
    const aContributionToB = estimateB?.contributions.find((entry) => entry.userId === userA.id);
    const bContributionToB = estimateB?.contributions.find((entry) => entry.userId === userB.id);

    assert.ok(report);
    assert.ok((aContributionToA?.raterSignal ?? 0) > (bContributionToA?.raterSignal ?? 0));
    assert.ok((bContributionToB?.raterSignal ?? 0) > (aContributionToB?.raterSignal ?? 0));
  });

  it('treats neutral ratings as neutral and not missing', () => {
    const reports = buildIslandAffinityReports(
      [{ userId: userA.id, islandId: islandY.id, rating: 0 }],
      profiles.byUserId,
      fixture.cohorts,
      [...fixture.islands, islandY]
    );

    const report = reports.byIslandId.get(islandY.id);
    const estimateA = report?.estimates.find((entry) => entry.cohortId === cohortA.id);

    assert.equal(estimateA?.rawCount, 1);
    assert.equal(estimateA?.neutralCount, 1);
    assert.equal(estimateA?.positiveCount, 0);
    assert.equal(estimateA?.negativeCount, 0);
    assert.equal(estimateA?.affinity, 0);
  });

  it('leaves missing islands at zero evidence', () => {
    const reports = buildIslandAffinityReports([], profiles.byUserId, fixture.cohorts, [...fixture.islands, islandY]);
    const report = reports.byIslandId.get(islandY.id);
    const estimateA = report?.estimates.find((entry) => entry.cohortId === cohortA.id);

    assert.equal(estimateA?.rawCount, 0);
    assert.equal(estimateA?.effectiveWeight, 0);
    assert.equal(estimateA?.confidence, 0);
  });

  it('shrinks tiny samples away from extreme affinity', () => {
    const reports = buildIslandAffinityReports(
      [{ userId: userA.id, islandId: islandX.id, rating: 1 }],
      profiles.byUserId,
      fixture.cohorts,
      [...fixture.islands, islandX]
    );

    const report = reports.byIslandId.get(islandX.id);
    const estimateA = report?.estimates.find((entry) => entry.cohortId === cohortA.id);

    assert.ok((estimateA?.affinity ?? 0) < 1);
    assert.ok((estimateA?.confidence ?? 1) < 1);
  });

  it('recomputes the same affinity reports from immutable rating events', () => {
    const events: AffinityRatingEvent[] = [
      { userId: userA.id, islandId: islandX.id, rating: 1 },
      { userId: userB.id, islandId: islandX.id, rating: -1 }
    ];

    const first = buildIslandAffinityReports(events, profiles.byUserId, fixture.cohorts, [...fixture.islands, islandX]);
    const second = buildIslandAffinityReports(events, profiles.byUserId, fixture.cohorts, [...fixture.islands, islandX]);

    assert.deepEqual(second, first);
  });
});

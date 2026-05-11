import { describe, expect, it } from 'vitest';
import { buildIslandAffinityReports, type AffinityRatingEvent } from '../model/affinity';
import { buildRaterSignalProfiles } from '../model/raterSignal';
import { computeInference } from '../model/inference';
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

    expect(report).toBeDefined();
    expect(aContributionToA?.raterSignal ?? 0).toBeGreaterThan(bContributionToA?.raterSignal ?? 0);
    expect(bContributionToB?.raterSignal ?? 0).toBeGreaterThan(aContributionToB?.raterSignal ?? 0);
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

    expect(estimateA?.rawCount).toBe(1);
    expect(estimateA?.neutralCount).toBe(1);
    expect(estimateA?.positiveCount).toBe(0);
    expect(estimateA?.negativeCount).toBe(0);
    expect(estimateA?.affinity).toBe(0);
  });

  it('leaves missing islands at zero evidence', () => {
    const reports = buildIslandAffinityReports([], profiles.byUserId, fixture.cohorts, [...fixture.islands, islandY]);
    const report = reports.byIslandId.get(islandY.id);
    const estimateA = report?.estimates.find((entry) => entry.cohortId === cohortA.id);

    expect(estimateA?.rawCount).toBe(0);
    expect(estimateA?.effectiveWeight).toBe(0);
    expect(estimateA?.confidence).toBe(0);
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

    expect(estimateA?.affinity ?? 0).toBeLessThan(1);
    expect(estimateA?.confidence ?? 1).toBeLessThan(1);
  });

  it('recomputes the same affinity reports from immutable rating events', () => {
    const events: AffinityRatingEvent[] = [
      { userId: userA.id, islandId: islandX.id, rating: 1 },
      { userId: userB.id, islandId: islandX.id, rating: -1 }
    ];

    const first = buildIslandAffinityReports(events, profiles.byUserId, fixture.cohorts, [...fixture.islands, islandX]);
    const second = buildIslandAffinityReports(events, profiles.byUserId, fixture.cohorts, [...fixture.islands, islandX]);

    expect(second).toEqual(first);
  });
});

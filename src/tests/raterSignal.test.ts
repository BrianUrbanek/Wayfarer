import { describe, expect, it } from 'vitest';
import { buildRaterSignalProfiles, buildRaterTrustProfiles } from '../model/raterSignal';
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

describe('rater signal profiles', () => {
  const fixture = buildFixture();
  const [cohortA, cohortB] = fixture.cohorts;

  it('gives matching users high signal for their cohort and low signal elsewhere', () => {
    const user = buildUser('user-a', 'User A', cohortA.tags, { ...cohortA.ratings });
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    expect(profile).toBeDefined();
    expect(profile?.topCohortId).toBe(cohortA.id);
    expect(profile?.overallSignal ?? 0).toBeGreaterThan(0);
    expect(profile?.cohortWeights[cohortA.id] ?? 0).toBeGreaterThan(profile?.cohortWeights[cohortB.id] ?? 0);
  });

  it('keeps low-overlap users at low evidence even when ratings look aligned', () => {
    const sparseRatings: Record<string, MaybeRating> = {
      'i-1': 1,
      'i-2': 1,
      'i-3': null,
      'i-4': null
    };
    const user = buildUser('user-sparse', 'Sparse User', cohortA.tags, sparseRatings);
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    expect(profile).toBeDefined();
    expect(profile?.signalEvidence ?? 0).toBe(0);
    expect(profile?.overallSignal ?? 0).toBe(0);
    expect(profile?.cohortWeights[cohortA.id] ?? 0).toBe(0);
  });

  it('does not use hidden generation fields when visible ratings are identical', () => {
    const visibleRatings: Record<string, MaybeRating> = { ...cohortA.ratings };
    const first = buildUser('user-one', 'User One', cohortA.tags, visibleRatings);
    const second = buildUser('user-two', 'User Two', cohortA.tags, visibleRatings);

    const firstInference = computeInference(first, fixture.cohorts, fixture.allTags, fixture.islands);
    const secondInference = computeInference(second, fixture.cohorts, fixture.allTags, fixture.islands);
    const analysis = buildRaterSignalProfiles(
      [first, second],
      new Map([
        [first.id, firstInference],
        [second.id, secondInference]
      ]),
      fixture.cohorts
    );

    const firstProfile = analysis.byUserId.get(first.id);
    const secondProfile = analysis.byUserId.get(second.id);

    expect(firstProfile).toBeDefined();
    expect(secondProfile).toBeDefined();
    expect(firstProfile?.overallSignal).toBe(secondProfile?.overallSignal);
    expect(firstProfile?.cohortWeights).toEqual(secondProfile?.cohortWeights);
    expect(firstProfile?.signalEvidence).toBe(secondProfile?.signalEvidence);
  });

  it('does not promote inverse users to high positive signal for the source cohort', () => {
    const inverseRatings: Record<string, MaybeRating> = {
      'i-1': -1,
      'i-2': -1,
      'i-3': 1,
      'i-4': 1
    };
    const user = buildUser('user-inverse', 'Inverse User', cohortA.tags, inverseRatings);
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    expect(profile).toBeDefined();
    expect(profile?.cohortWeights[cohortA.id] ?? 0).toBe(0);
    expect(profile?.cohortWeights[cohortB.id] ?? 0).toBeGreaterThan(0);
  });

  it('maps trust adapter values 1:1 from signal profiles', () => {
    const user = buildUser('user-trust', 'Trust User', cohortA.tags, { ...cohortA.ratings });
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const signal = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);
    const trust = buildRaterTrustProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    expect(signal).toBeDefined();
    expect(trust).toBeDefined();
    expect(trust?.overallTrust).toBe(signal?.overallSignal);
    expect(trust?.trustEvidence).toBe(signal?.signalEvidence);
    expect(trust?.topTrustedCohortId).toBe(signal?.topCohortId);
    expect(trust?.cohortTrustWeights).toEqual(signal?.cohortWeights);
    expect(trust?.cohortEvidence).toEqual(signal?.cohortEvidence);
    expect(trust?.cohortSimilarities).toEqual(signal?.cohortSimilarities);
  });
});

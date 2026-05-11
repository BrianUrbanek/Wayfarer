import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

function buildUser(
  id: string,
  label: string,
  declaredTags: string[],
  ratings: Record<string, MaybeRating>,
  hiddenSeedCohortId?: string,
  hiddenTagAlignment?: number,
  hiddenRatingAlignment?: number
): User {
  return {
    id,
    label,
    declaredTags,
    ratings,
    hiddenSeedCohortId,
    hiddenTagAlignment,
    hiddenRatingAlignment
  };
}

describe('rater signal profiles', () => {
  const fixture = buildFixture();
  const [cohortA, cohortB] = fixture.cohorts;

  it('gives matching users high signal for their cohort and low signal elsewhere', () => {
    const user = buildUser('user-a', 'User A', cohortA.tags, { ...cohortA.ratings }, cohortA.id, 10, 10);
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    assert.ok(profile);
    assert.equal(profile.topCohortId, cohortA.id);
    assert.ok((profile.overallSignal ?? 0) > 0);
    assert.ok((profile.cohortWeights[cohortA.id] ?? 0) > (profile.cohortWeights[cohortB.id] ?? 0));
  });

  it('keeps low-overlap users at low evidence even when ratings look aligned', () => {
    const sparseRatings: Record<string, MaybeRating> = {
      'i-1': 1,
      'i-2': 1,
      'i-3': null,
      'i-4': null
    };
    const user = buildUser('user-sparse', 'Sparse User', cohortA.tags, sparseRatings, cohortA.id, 10, 10);
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    assert.ok(profile);
    assert.equal(profile.signalEvidence, 0);
    assert.equal(profile.overallSignal, 0);
    assert.equal(profile.cohortWeights[cohortA.id], 0);
  });

  it('does not use hidden generation fields when visible ratings are identical', () => {
    const visibleRatings: Record<string, MaybeRating> = { ...cohortA.ratings };
    const first = buildUser('user-one', 'User One', cohortA.tags, visibleRatings, cohortA.id, 10, 10);
    const second = buildUser('user-two', 'User Two', cohortA.tags, visibleRatings, cohortB.id, 0, 0);

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

    assert.ok(firstProfile);
    assert.ok(secondProfile);
    assert.equal(firstProfile.overallSignal, secondProfile.overallSignal);
    assert.deepEqual(firstProfile.cohortWeights, secondProfile.cohortWeights);
    assert.equal(firstProfile.signalEvidence, secondProfile.signalEvidence);
  });

  it('does not promote inverse users to high positive signal for the source cohort', () => {
    const inverseRatings: Record<string, MaybeRating> = {
      'i-1': -1,
      'i-2': -1,
      'i-3': 1,
      'i-4': 1
    };
    const user = buildUser('user-inverse', 'Inverse User', cohortA.tags, inverseRatings, cohortA.id, 10, 0);
    const inference = computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands);
    const profile = buildRaterSignalProfiles([user], new Map([[user.id, inference]]), fixture.cohorts).byUserId.get(user.id);

    assert.ok(profile);
    assert.equal(profile.cohortWeights[cohortA.id], 0);
    assert.ok((profile.cohortWeights[cohortB.id] ?? 0) > 0);
  });
});

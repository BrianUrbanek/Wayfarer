import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceIslandCohortRatingState,
  buildIslandCohortRatingSnapshots,
  createIslandCohortRatingState,
  softResetIslandCohortRatingState
} from '../../model/islandCohortRating.js';
import type { CohortAnchor, Island, User } from '../../model/types.js';

function buildFixture() {
  const islands: Island[] = [{ id: 'island-1', label: 'Island 1' }];
  const cohorts: CohortAnchor[] = [
    {
      id: 'cohort-1',
      label: 'Cohort 1',
      tags: ['alpha', 'beta'],
      ratings: { 'island-1': 1 },
      source: 'meta_moderator'
    }
  ];
  const users: User[] = [
    {
      id: 'user-1',
      label: 'User 1',
      declaredTags: ['alpha'],
      ratings: { 'island-1': 1 }
    }
  ];

  return { islands, cohorts, users };
}

describe('island/cohort rating substrate', () => {
  it('moves more from the same evidence when rating deviation is high', () => {
    const lowRD = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    lowRD.ratingDeviation = 0.15;
    const highRD = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    highRD.ratingDeviation = 0.85;

    const evidence = {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      evidenceCount: 1
    };

    const nextLow = advanceIslandCohortRatingState(lowRD, evidence);
    const nextHigh = advanceIslandCohortRatingState(highRD, evidence);

    assert.ok(nextHigh.rating > nextLow.rating);
    assert.ok(nextHigh.confidence < nextLow.confidence);
  });

  it('lowers rating deviation under consistent evidence and soft reset widens it again', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const evidence = {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      evidenceCount: 1
    };

    const afterOne = advanceIslandCohortRatingState(base, evidence);
    const afterTwo = advanceIslandCohortRatingState(afterOne, evidence);
    const reset = softResetIslandCohortRatingState(afterTwo);
    const afterReset = advanceIslandCohortRatingState(reset, evidence);

    assert.ok(afterTwo.ratingDeviation < afterOne.ratingDeviation);
    assert.ok(afterReset.ratingDeviation > afterTwo.ratingDeviation);
    assert.ok(afterReset.rating > afterTwo.rating);
  });

  it('raises volatility or prevents overconfidence when evidence contradicts prior fit', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const positive = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      evidenceCount: 1
    });
    const contradictory = advanceIslandCohortRatingState(positive, {
      turn: 2,
      primaryEvidenceMean: -1,
      primaryEvidenceWeight: 1,
      behaviorSupport: -1,
      evidenceCount: 1
    });

    assert.ok(contradictory.volatility >= positive.volatility);
    assert.ok(contradictory.confidence <= positive.confidence);
  });

  it('builds turn snapshots from event history', () => {
    const fixture = buildFixture();
    const snapshots = buildIslandCohortRatingSnapshots({
      islands: fixture.islands,
      cohorts: fixture.cohorts,
      ratingEvents: [
        {
          id: 'event-1',
          turn: 0,
          userId: fixture.users[0].id,
          islandId: fixture.islands[0].id,
          rating: 1,
          source: 'organic',
          raterSignalWeights: { 'cohort-1': 1 }
        }
      ],
      observedBehaviorEvents: [],
      turnHistory: [{ turn: 0 }]
    });

    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0]?.islandId, 'island-1');
    assert.equal(snapshots[0]?.cohortId, 'cohort-1');
    assert.equal(typeof snapshots[0]?.ratingDeviation, 'number');
  });
});

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

  it('keeps passive no-evidence decay weaker than meaningful evidence gain', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const meaningful = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      evidenceCount: 1
    });
    const missing = advanceIslandCohortRatingState(meaningful, {
      turn: 2,
      primaryEvidenceMean: 0,
      primaryEvidenceWeight: 0,
      behaviorSupport: 0,
      evidenceCount: 0
    });

    assert.ok(base.ratingDeviation - meaningful.ratingDeviation > missing.ratingDeviation - meaningful.ratingDeviation);
  });

  it('does not passively decay never-evidenced cells', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const missing = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 0,
      primaryEvidenceWeight: 0,
      behaviorSupport: 0,
      evidenceCount: 0
    });

    assert.equal(missing.ratingDeviation, base.ratingDeviation);
    assert.equal(missing.confidence, base.confidence);
    assert.equal(missing.lastUpdatedTurn, base.lastUpdatedTurn);
  });

  it('does not erase confidence across a short unsampled window after evidence', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const evidenced = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      evidenceCount: 1
    });
    let current = evidenced;

    for (let turn = 2; turn <= 4; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 0,
        primaryEvidenceWeight: 0,
        behaviorSupport: 0,
        evidenceCount: 0
      });
    }

    assert.equal(current.confidence, evidenced.confidence);
  });

  it('treats repeated neutral evidence as known-neutral confidence', () => {
    let current = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });

    for (let turn = 1; turn <= 12; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 0,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        evidenceCount: 1
      });
    }

    assert.ok(Math.abs(current.affinity) < 0.05);
    assert.ok(current.confidence > 0.5);
  });

  it('keeps low-evidence strong affinity provisional while consistent polarity gains confidence', () => {
    const lowEvidence = advanceIslandCohortRatingState(createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' }), {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 0.3,
      behaviorSupport: 0,
      evidenceCount: 1
    });
    let positive = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    let negative = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });

    for (let turn = 1; turn <= 12; turn += 1) {
      positive = advanceIslandCohortRatingState(positive, {
        turn,
        primaryEvidenceMean: 1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        evidenceCount: 1
      });
      negative = advanceIslandCohortRatingState(negative, {
        turn,
        primaryEvidenceMean: -1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        evidenceCount: 1
      });
    }

    assert.ok(lowEvidence.confidence < 0.15);
    assert.ok(positive.affinity > 0);
    assert.ok(positive.confidence > lowEvidence.confidence);
    assert.ok(negative.affinity < 0);
    assert.ok(negative.confidence > lowEvidence.confidence);
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

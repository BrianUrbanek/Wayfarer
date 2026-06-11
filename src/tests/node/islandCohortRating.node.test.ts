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
  it('accumulates support quickly under trusted consensus and collapses RD', () => {
    let current = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });

    for (let turn = 1; turn <= 6; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 1
      });
    }

    assert.ok(current.support > 5);
    assert.ok(current.ratingDeviation < 0.35);
    assert.ok(current.confidence > 0.65);
  });

  it('spreads the same total evidence across turns without arbitrary capping', () => {
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

    const burst = buildIslandCohortRatingSnapshots({
      islands,
      cohorts,
      turnHistory: [{ turn: 0 }],
      observedBehaviorEvents: [],
      ratingEvents: [
        { id: 'burst-1', turn: 0, userId: 'u-1', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } },
        { id: 'burst-2', turn: 0, userId: 'u-2', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } },
        { id: 'burst-3', turn: 0, userId: 'u-3', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } }
      ]
    }).at(-1);

    const spread = buildIslandCohortRatingSnapshots({
      islands,
      cohorts,
      turnHistory: [{ turn: 0 }, { turn: 1 }, { turn: 2 }],
      observedBehaviorEvents: [],
      ratingEvents: [
        { id: 'spread-1', turn: 0, userId: 'u-1', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } },
        { id: 'spread-2', turn: 1, userId: 'u-2', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } },
        { id: 'spread-3', turn: 2, userId: 'u-3', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: { 'cohort-1': 1 } }
      ]
    }).at(-1);

    assert.ok((burst?.support ?? 0) > 0);
    assert.ok(Math.abs((burst?.ratingDeviation ?? 0) - (spread?.ratingDeviation ?? 0)) < 0.05);
    assert.ok(Math.abs((burst?.confidence ?? 0) - (spread?.confidence ?? 0)) < 0.05);
  });

  it('raises volatility for same-turn split evidence even when the aggregate mean is near neutral', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    let current = base;

    for (let turn = 1; turn <= 5; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 1
      });
    }

    const split = advanceIslandCohortRatingState(current, {
      turn: 6,
      primaryEvidenceMean: 0,
      primaryEvidenceWeight: 2,
      behaviorSupport: 0,
      splitPressure: 1,
      evidenceCount: 2
    });

    assert.ok(split.volatility > current.volatility);
    assert.ok(split.ratingDeviation > current.ratingDeviation);
    assert.ok(split.rating > -0.25);
    assert.ok(split.rating < 0.9);
  });

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
      splitPressure: 0,
      evidenceCount: 1
    };

    const nextLow = advanceIslandCohortRatingState(lowRD, evidence);
    const nextHigh = advanceIslandCohortRatingState(highRD, evidence);

    assert.ok(nextHigh.rating > nextLow.rating);
    assert.ok((1 - nextHigh.rating) < (1 - nextLow.rating));
  });

  it('lowers RD under consistent evidence and preserves prior support through soft reset', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const evidence = {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      splitPressure: 0,
      evidenceCount: 1
    };

    const afterOne = advanceIslandCohortRatingState(base, evidence);
    const afterTwo = advanceIslandCohortRatingState(afterOne, evidence);
    const reset = softResetIslandCohortRatingState(afterTwo);
    const afterReset = advanceIslandCohortRatingState(reset, evidence);

    assert.ok(afterTwo.ratingDeviation < afterOne.ratingDeviation);
    assert.equal(reset.support, afterTwo.support);
    assert.ok(afterReset.support > afterTwo.support);
    assert.ok(afterReset.rating > afterTwo.rating);
  });

  it('raises volatility and partially reopens RD on same-epoch contradiction', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    let positive = base;
    for (let turn = 1; turn <= 6; turn += 1) {
      positive = advanceIslandCohortRatingState(positive, {
        turn,
        primaryEvidenceMean: 1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 1
      });
    }
    const contradictory = advanceIslandCohortRatingState(positive, {
      turn: 7,
      primaryEvidenceMean: -1,
      primaryEvidenceWeight: 1,
      behaviorSupport: -1,
      splitPressure: 0,
      evidenceCount: 1
    });

    assert.ok(contradictory.support > positive.support);
    assert.ok(contradictory.volatility > positive.volatility);
    assert.ok(contradictory.ratingDeviation > positive.ratingDeviation);
    assert.ok(contradictory.rating > -1);
  });

  it('does not decay rating deviation or confidence when an evidenced cell receives no new evidence', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const meaningful = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      splitPressure: 0,
      evidenceCount: 1
    });
    let missing = meaningful;

    for (let turn = 2; turn <= 30; turn += 1) {
      missing = advanceIslandCohortRatingState(missing, {
        turn,
        primaryEvidenceMean: 0,
        primaryEvidenceWeight: 0,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 0
      });
    }

    assert.equal(missing.ratingDeviation, meaningful.ratingDeviation);
    assert.equal(missing.confidence, meaningful.confidence);
    assert.equal(missing.evidenceCount, meaningful.evidenceCount);
    assert.equal(missing.effectiveWeight, meaningful.effectiveWeight);
    assert.equal(missing.support, meaningful.support);
  });

  it('does not passively decay never-evidenced cells', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const missing = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 0,
      primaryEvidenceWeight: 0,
      behaviorSupport: 0,
      splitPressure: 0,
      evidenceCount: 0
    });

    assert.equal(missing.ratingDeviation, base.ratingDeviation);
    assert.equal(missing.confidence, base.confidence);
    assert.equal(missing.lastUpdatedTurn, base.lastUpdatedTurn);
    assert.equal(missing.support, base.support);
  });

  it('does not erase confidence across a short unsampled window after evidence', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    const evidenced = advanceIslandCohortRatingState(base, {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 1,
      behaviorSupport: 0,
      splitPressure: 0,
      evidenceCount: 1
    });
    let current = evidenced;

    for (let turn = 2; turn <= 4; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 0,
        primaryEvidenceWeight: 0,
        behaviorSupport: 0,
        splitPressure: 0,
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
        splitPressure: 0,
        evidenceCount: 1
      });
    }

    assert.ok(Math.abs(current.affinity) < 0.05);
    assert.ok(current.confidence > 0.5);
  });

  it('lets sparse evidence move early without locking too soon', () => {
    const lowEvidence = advanceIslandCohortRatingState(createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' }), {
      turn: 1,
      primaryEvidenceMean: 1,
      primaryEvidenceWeight: 0.3,
      behaviorSupport: 0,
      splitPressure: 0,
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
        splitPressure: 0,
        evidenceCount: 1
      });
      negative = advanceIslandCohortRatingState(negative, {
        turn,
        primaryEvidenceMean: -1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 1
      });
    }

    assert.ok(lowEvidence.affinity > 0.05);
    assert.ok(lowEvidence.confidence < 0.4);
    assert.ok(positive.affinity > 0);
    assert.ok(positive.confidence > lowEvidence.confidence);
    assert.ok(negative.affinity < 0);
    assert.ok(negative.confidence > lowEvidence.confidence);
  });

  it('reopens RD on reset without deleting accumulated support or raising volatility by default', () => {
    const base = createIslandCohortRatingState({ islandId: 'island-1', cohortId: 'cohort-1' });
    let current = base;

    for (let turn = 1; turn <= 4; turn += 1) {
      current = advanceIslandCohortRatingState(current, {
        turn,
        primaryEvidenceMean: 1,
        primaryEvidenceWeight: 1,
        behaviorSupport: 0,
        splitPressure: 0,
        evidenceCount: 1
      });
    }

    const reset = softResetIslandCohortRatingState(current);
    assert.equal(reset.support, current.support);
    assert.ok(reset.ratingDeviation > current.ratingDeviation);
    assert.equal(reset.volatility, current.volatility);
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
    assert.equal(typeof snapshots[0]?.support, 'number');
  });
});

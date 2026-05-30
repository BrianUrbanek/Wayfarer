import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBatchTotals } from '../../ui/recentActionSummary.js';

describe('recent action summary helper', () => {
  it('aggregates batch totals across multiple turns', () => {
    const totals = aggregateBatchTotals([
      {
        turn: 1,
        mode: 'mixed',
        participatingUserIds: ['u1', 'u2'],
        ratingsCreated: 3,
        organicRatingsCreated: 2,
        guidedRatingsCreated: 1,
        newlyRatedIslandIds: ['i1', 'i2'],
        routedIslandIds: ['i2'],
        recommendationKinds: { SAFE_FIT: 1, SMART_GAMBLE: 0, DISCOVERY_PROBE: 0 },
        diagnosisCounts: { HIGH_SIGNAL: 0, MISMATCH_RETAG: 0, INVERSE_PROFILE: 0, UNKNOWN_OR_NOISY: 0, LOW_SIGNAL: 0, AMBIGUOUS: 0, UNEXPLAINED_PREDICTIVE: 0 }
      },
      {
        turn: 2,
        mode: 'mixed',
        participatingUserIds: ['u2', 'u3'],
        ratingsCreated: 2,
        organicRatingsCreated: 1,
        guidedRatingsCreated: 1,
        newlyRatedIslandIds: ['i2', 'i3'],
        routedIslandIds: ['i3'],
        recommendationKinds: { SAFE_FIT: 0, SMART_GAMBLE: 0, DISCOVERY_PROBE: 1 },
        diagnosisCounts: { HIGH_SIGNAL: 0, MISMATCH_RETAG: 0, INVERSE_PROFILE: 0, UNKNOWN_OR_NOISY: 0, LOW_SIGNAL: 0, AMBIGUOUS: 0, UNEXPLAINED_PREDICTIVE: 0 }
      }
    ]);

    assert.equal(totals.ratingsCreated, 5);
    assert.equal(totals.organicRatingsCreated, 3);
    assert.equal(totals.guidedRatingsCreated, 2);
    assert.equal(totals.participatingUsers, 3);
    assert.equal(totals.newlyRatedIslands, 3);
    assert.equal(totals.routedIslands, 2);
    assert.equal(totals.safeFitsRouted, 1);
    assert.equal(totals.discoveryProbesRouted, 1);
  });
});

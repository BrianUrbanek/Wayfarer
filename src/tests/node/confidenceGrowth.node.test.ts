import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfidenceGrowthRows } from '../../model/confidenceGrowth.js';
import type { SimulationState } from '../../model/simulation.js';

describe('confidence growth helper', () => {
  it('handles empty snapshot history', () => {
    const rows = buildConfidenceGrowthRows({
      confidenceSnapshots: [],
      turnHistory: []
    } as unknown as SimulationState);

    assert.deepEqual(rows, []);
  });

  it('aggregates turn rows from stored snapshots deterministically', () => {
    const state = {
      confidenceSnapshots: [
        { turn: 0, islandId: 'i-1', cohortId: 'c-1', affinity: 0.1, confidence: 0.2, effectiveWeight: 1, rawCount: 1 },
        { turn: 0, islandId: 'i-1', cohortId: 'c-2', affinity: -0.1, confidence: 0.8, effectiveWeight: 3, rawCount: 1 },
        { turn: 1, islandId: 'i-1', cohortId: 'c-1', affinity: 0.4, confidence: 0.9, effectiveWeight: 4, rawCount: 2 }
      ],
      turnHistory: [
        {
          turn: 0,
          ratingsCreated: 2,
          organicRatingsCreated: 2,
          guidedRatingsCreated: 0,
          mode: 'organic',
          participatingUserIds: ['u-1'],
          newlyRatedIslandIds: ['i-1'],
          routedIslandIds: ['i-1'],
          recommendationKinds: { SAFE_FIT: 1, DISCOVERY_PROBE: 0 },
          diagnosisCounts: { HIGH_SIGNAL: 0, MISMATCH_RETAG: 0, INVERSE_PROFILE: 0, UNKNOWN_OR_NOISY: 0, LOW_SIGNAL: 0, AMBIGUOUS: 0, UNEXPLAINED_PREDICTIVE: 0 }
        },
        {
          turn: 1,
          ratingsCreated: 3,
          organicRatingsCreated: 2,
          guidedRatingsCreated: 1,
          mode: 'mixed',
          participatingUserIds: ['u-1', 'u-2'],
          newlyRatedIslandIds: ['i-2'],
          routedIslandIds: ['i-2'],
          recommendationKinds: { SAFE_FIT: 0, DISCOVERY_PROBE: 1 },
          diagnosisCounts: { HIGH_SIGNAL: 0, MISMATCH_RETAG: 0, INVERSE_PROFILE: 0, UNKNOWN_OR_NOISY: 0, LOW_SIGNAL: 0, AMBIGUOUS: 0, UNEXPLAINED_PREDICTIVE: 0 }
        }
      ]
    } as unknown as SimulationState;

    const rows = buildConfidenceGrowthRows(state);

    assert.deepEqual(rows, [
      {
        turn: 0,
        ratingsCreated: 2,
        cumulativeRatingEvents: 2,
        averageIslandCohortConfidence: 0.5,
        averageEffectiveWeight: 2,
        estimatesAbove25: 1,
        estimatesAbove50: 1,
        estimatesAbove75: 1,
        routedIslandCount: 1,
        safeFitCount: 1,
        discoveryProbeCount: 0
      },
      {
        turn: 1,
        ratingsCreated: 3,
        cumulativeRatingEvents: 5,
        averageIslandCohortConfidence: 0.9,
        averageEffectiveWeight: 4,
        estimatesAbove25: 1,
        estimatesAbove50: 1,
        estimatesAbove75: 1,
        routedIslandCount: 1,
        safeFitCount: 0,
        discoveryProbeCount: 1
      }
    ]);
  });
});

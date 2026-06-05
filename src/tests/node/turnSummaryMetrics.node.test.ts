import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnSummaryMetrics } from '../../ui/overview/turnSummaryMetrics.js';

describe('turn summary metric presentation', () => {
  it('provides every metric with a unique explanation without changing input values', () => {
    const metrics = buildTurnSummaryMetrics({
      currentTurn: 4,
      totalRatingEvents: 18,
      turnModeLabel: 'Mixed',
      turnSummary: {
        turn: 4,
        mode: 'mixed',
        participatingUserIds: ['user-1', 'user-2'],
        ratingsCreated: 5,
        organicRatingsCreated: 3,
        guidedRatingsCreated: 2,
        newlyRatedIslandIds: ['island-1'],
        routedIslandIds: ['island-1'],
        recommendationKinds: { SAFE_FIT: 1, SMART_GAMBLE: 1, DISCOVERY_PROBE: 0 },
        diagnosisCounts: {
          HIGH_SIGNAL: 0,
          INVERSE_PROFILE: 0,
          MISMATCH_RETAG: 0,
          UNKNOWN_OR_NOISY: 0,
          LOW_SIGNAL: 0,
          AMBIGUOUS: 0,
          UNEXPLAINED_PREDICTIVE: 0
        }
      }
    });

    assert.equal(metrics.length, 11);
    assert.equal(metrics.find((metric) => metric.key === 'rating-events')?.value, 18);
    assert.equal(metrics.find((metric) => metric.key === 'ratings-this-turn')?.value, 5);
    const explanations = metrics.map((metric) => metric.explanation);
    assert.equal(explanations.every((explanation) => Boolean(explanation?.trim())), true);
    assert.equal(new Set(explanations).size, explanations.length);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataFitnessSummary } from '../../model/dataFitness.js';

describe('data fitness helper', () => {
  it('flags sparse evidence in initial state', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      totalIslands: 10,
      ratingEventCount: 0,
      averageRatingsPerUser: 0,
      usersWithUsableSignal: 0,
      averageSignalEvidence: 0,
      lastTurnRatingsCreated: 0,
      turnMode: 'organic',
      eligibleRecommendationUsers: 0,
      ratedPairCoverage: 0
    });
    assert.equal(summary.status, 'not-ready');
    assert.equal(summary.warnings.some((warning) => warning.kind === 'sparse-evidence'), true);
  });
});

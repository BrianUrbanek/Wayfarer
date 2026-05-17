import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDataFitnessSummary } from '../../model/dataFitness.js';

describe('data fitness helper', () => {
  it('flags sparse evidence in initial state', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      ratingEventCount: 0,
      averageRatingsPerUser: 0,
      usersWithUsableSignal: 0,
      averageSignalEvidence: 0,
      lastTurnRatingsCreated: 0,
      hasTurnHistory: false,
      turnMode: 'organic',
      eligibleRecommendationUsers: 0,
      ratedPairCoverage: 0
    });
    assert.equal(summary.status, 'not-ready');
    assert.equal(summary.warnings.some((warning) => warning.kind === 'sparse-evidence'), true);
  });

  it('flags routing unavailable in guided mode with no eligible users', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      ratingEventCount: 20,
      averageRatingsPerUser: 2,
      usersWithUsableSignal: 2,
      averageSignalEvidence: 0.3,
      lastTurnRatingsCreated: 2,
      hasTurnHistory: true,
      turnMode: 'guided',
      eligibleRecommendationUsers: 0,
      ratedPairCoverage: 0.2
    });
    assert.equal(summary.warnings.some((warning) => warning.kind === 'routing-unavailable'), true);
  });

  it('flags zero-event turns and exhaustion separately when a turn exists', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      ratingEventCount: 95,
      averageRatingsPerUser: 9.5,
      usersWithUsableSignal: 8,
      averageSignalEvidence: 0.8,
      lastTurnRatingsCreated: 0,
      hasTurnHistory: true,
      turnMode: 'mixed',
      eligibleRecommendationUsers: 1,
      ratedPairCoverage: 0.95
    });
    assert.equal(summary.warnings.some((warning) => warning.kind === 'zero-event'), true);
    assert.equal(summary.warnings.some((warning) => warning.kind === 'exhausted'), true);
  });

  it('resolves ready status when no warnings fire', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      ratingEventCount: 40,
      averageRatingsPerUser: 4,
      usersWithUsableSignal: 6,
      averageSignalEvidence: 0.6,
      lastTurnRatingsCreated: 3,
      hasTurnHistory: true,
      turnMode: 'organic',
      eligibleRecommendationUsers: 4,
      ratedPairCoverage: 0.4
    });
    assert.equal(summary.status, 'ready');
    assert.equal(summary.warnings.length, 0);
  });
});

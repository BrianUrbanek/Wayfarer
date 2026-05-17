import { describe, expect, it } from 'vitest';
import { buildDataFitnessSummary } from '../model/dataFitness';

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
    expect(summary.status).toBe('not-ready');
    expect(summary.warnings.some((warning) => warning.kind === 'sparse-evidence')).toBe(true);
  });

  it('flags routing unavailable in guided mode with no eligible users', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      totalIslands: 10,
      ratingEventCount: 20,
      averageRatingsPerUser: 2,
      usersWithUsableSignal: 2,
      averageSignalEvidence: 0.3,
      lastTurnRatingsCreated: 2,
      turnMode: 'guided',
      eligibleRecommendationUsers: 0,
      ratedPairCoverage: 0.2
    });
    expect(summary.warnings.some((warning) => warning.kind === 'routing-unavailable')).toBe(true);
  });

  it('flags zero-event turns and exhaustion separately', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      totalIslands: 10,
      ratingEventCount: 95,
      averageRatingsPerUser: 9.5,
      usersWithUsableSignal: 8,
      averageSignalEvidence: 0.8,
      lastTurnRatingsCreated: 0,
      turnMode: 'mixed',
      eligibleRecommendationUsers: 1,
      ratedPairCoverage: 0.95
    });
    expect(summary.warnings.some((warning) => warning.kind === 'zero-event')).toBe(true);
    expect(summary.warnings.some((warning) => warning.kind === 'exhausted')).toBe(true);
  });

  it('resolves ready status when no warnings fire', () => {
    const summary = buildDataFitnessSummary({
      totalUsers: 10,
      totalIslands: 10,
      ratingEventCount: 40,
      averageRatingsPerUser: 4,
      usersWithUsableSignal: 6,
      averageSignalEvidence: 0.6,
      lastTurnRatingsCreated: 3,
      turnMode: 'organic',
      eligibleRecommendationUsers: 4,
      ratedPairCoverage: 0.4
    });
    expect(summary.status).toBe('ready');
    expect(summary.warnings).toHaveLength(0);
  });
});

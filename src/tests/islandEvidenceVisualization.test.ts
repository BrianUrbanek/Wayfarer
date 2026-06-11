import { describe, expect, it } from 'vitest';
import { buildIslandEvidenceConstellation, buildIslandRatingTimelineRows } from '../model/islandEvidenceVisualization';

describe('island evidence visualization helper', () => {
  it('builds selected-island timeline rows in turn order with expected fields', () => {
    const rows = buildIslandRatingTimelineRows('island-1', [
      { turn: 1, islandId: 'island-1', cohortId: 'c-b', affinity: 0.1, confidence: 0.3, ratingDeviation: 0.7, uncertainty: 0.7, volatility: 0.1, support: 1, effectiveWeight: 1, evidenceCount: 1, rating: 0.1, lastUpdatedTurn: 1, version: 1 },
      { turn: 0, islandId: 'island-1', cohortId: 'c-a', affinity: 0.2, confidence: 0.4, ratingDeviation: 0.6, uncertainty: 0.6, volatility: 0.1, support: 2, effectiveWeight: 2, evidenceCount: 2, rating: 0.2, lastUpdatedTurn: 0, version: 1 },
      { turn: 0, islandId: 'island-2', cohortId: 'c-a', affinity: 0.9, confidence: 0.9, ratingDeviation: 0.1, uncertainty: 0.1, volatility: 0.1, support: 3, effectiveWeight: 3, evidenceCount: 3, rating: 0.9, lastUpdatedTurn: 0, version: 1 }
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.turn).toBe(0);
    expect(rows[1]?.turn).toBe(1);
    expect(rows[0]).toHaveProperty('volatility');
    expect(rows[0]).toHaveProperty('evidenceCount');
  });

  it('builds constellation points using strongest cohort weight and polarity', () => {
    const model = buildIslandEvidenceConstellation({
      islandId: 'island-1',
      events: [{ id: 'e-1', turn: 2, userId: 'u-1', islandId: 'island-1', rating: -1, raterSignalWeights: { 'c-a': 0.7, 'c-b': 0.2 } }],
      ratingEventWeightRows: [{ eventId: 'e-1', userId: 'u-1', islandId: 'island-1', cohortId: 'c-a', rating: -1, trustWeight: 0.7, currentContextConfidence: 0.4, uncertaintyLeverage: 0.6, eventWeight: 0.42, directionalContribution: -0.42 }],
      cohortLabelById: new Map([['c-a', 'A'], ['c-b', 'B']])
    });
    expect(model.points).toHaveLength(1);
    expect(model.points[0]?.primaryCohortId).toBe('c-a');
    expect(model.points[0]?.rating).toBe(-1);
    expect(model.usesRatingEventWeightRows).toBe(true);
  });
});

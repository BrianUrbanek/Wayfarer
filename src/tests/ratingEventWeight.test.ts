import { describe, expect, it } from 'vitest';
import { deriveRatingEventWeightsForIsland } from '../model/ratingEventWeight';

describe('rating event weight helper', () => {
  const affinityReport = {
    islandId: 'i-1',
    estimates: [
      { cohortId: 'c-a', confidence: 0.8 },
      { cohortId: 'c-b', confidence: 0.2 }
    ]
  } as any;

  const baseEvent = {
    id: 'e-1',
    userId: 'u-1',
    islandId: 'i-1',
    rating: 1 as const,
    raterSignalWeights: { 'c-a': 0.5, 'c-b': 0.5 }
  };

  it('zero trust gives zero event weight', () => {
    const rows = deriveRatingEventWeightsForIsland('i-1', [{ ...baseEvent, raterSignalWeights: { 'c-a': 0, 'c-b': 0 } }], affinityReport);
    expect(rows.every((row) => row.eventWeight === 0)).toBe(true);
  });

  it('high confidence gives lower leverage than low confidence', () => {
    const rows = deriveRatingEventWeightsForIsland('i-1', [baseEvent], affinityReport);
    const high = rows.find((row) => row.cohortId === 'c-a');
    const low = rows.find((row) => row.cohortId === 'c-b');
    expect((high?.uncertaintyLeverage ?? 0)).toBeLessThan(low?.uncertaintyLeverage ?? 0);
  });

  it('negative ratings keep negative directional contribution', () => {
    const rows = deriveRatingEventWeightsForIsland('i-1', [{ ...baseEvent, rating: -1 as const }], affinityReport);
    expect(rows.every((row) => row.eventWeight >= 0)).toBe(true);
    expect(rows.every((row) => row.directionalContribution <= 0)).toBe(true);
  });

  it('missing trust weight uses safe zero behavior', () => {
    const rows = deriveRatingEventWeightsForIsland('i-1', [{ ...baseEvent, raterSignalWeights: {} }], affinityReport);
    expect(rows.every((row) => row.trustWeight === 0 && row.eventWeight === 0)).toBe(true);
  });

  it('is deterministic for same input', () => {
    const first = deriveRatingEventWeightsForIsland('i-1', [baseEvent], affinityReport);
    const second = deriveRatingEventWeightsForIsland('i-1', [baseEvent], affinityReport);
    expect(second).toEqual(first);
  });
});

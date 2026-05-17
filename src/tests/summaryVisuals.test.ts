import { describe, expect, it } from 'vitest';
import { collapseDistributionSlices, computeDeclaredTagOverlap, shouldPromoteInverseSignal, summarizeBehaviorRead } from '../ui/summaryVisuals';

describe('summary visuals helpers', () => {
  it('computes exact declared tag overlap', () => {
    const overlap = computeDeclaredTagOverlap(['a', 'b', 'c'], { id: 'x', label: 'X', tags: ['a', 'b', 'c'], ratings: {}, source: 'meta_moderator' });
    expect(overlap.overlap).toBe(3);
    expect(overlap.total).toBe(3);
    expect(overlap.isExact).toBe(true);
  });

  it('collapses distribution slices deterministically', () => {
    const slices = collapseDistributionSlices(
      [
        { cohortId: 'a', score: 0.4 },
        { cohortId: 'b', score: 0.3 },
        { cohortId: 'c', score: 0.2 },
        { cohortId: 'd', score: 0.1 }
      ],
      (id) => id ?? 'none',
      4
    );
    expect(slices).toHaveLength(4);
    expect(slices[3]?.label).toBe('Other');
    expect(Math.round((slices[3]?.score ?? 0) * 100)).toBe(10);
  });

  it('marks diffuse behavior when gap is small', () => {
    const summary = summarizeBehaviorRead(
      [
        { cohortId: 'a', score: 0.38 },
        { cohortId: 'b', score: 0.34 }
      ],
      0.04
    );
    expect(summary.tone).toBe('diffuse');
  });

  it('demotes inverse signal unless it is strong and behavior specificity is low', () => {
    expect(shouldPromoteInverseSignal(0.22, 0.05)).toBe(false);
    expect(shouldPromoteInverseSignal(0.42, 0.08)).toBe(true);
    expect(shouldPromoteInverseSignal(0.42, 0.2)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { collapseDistributionSlices, computeDeclaredTagOverlap, shouldPromoteInverseSignal, summarizeBehaviorRead } from '../ui/summaryVisuals';

describe('summary visuals helpers', () => {
  it('computes exact declared tag overlap', () => {
    const overlap = computeDeclaredTagOverlap(['a', 'b', 'c'], { id: 'x', label: 'X', tags: ['a', 'b', 'c'], ratings: {}, source: 'meta_moderator' });
    expect(overlap.overlap).toBe(3);
    expect(overlap.total).toBe(3);
    expect(overlap.isExact).toBe(true);
  });

  it('computes partial overlap as non-exact against full cohort tag count', () => {
    const overlap = computeDeclaredTagOverlap(['a'], { id: 'x', label: 'X', tags: ['a', 'b', 'c'], ratings: {}, source: 'meta_moderator' });
    expect(overlap.overlap).toBe(1);
    expect(overlap.total).toBe(3);
    expect(overlap.isExact).toBe(false);
  });

  it('does not count extra declared tags as exact', () => {
    const overlap = computeDeclaredTagOverlap(['a', 'b', 'c', 'extra'], { id: 'x', label: 'X', tags: ['a', 'b', 'c'], ratings: {}, source: 'meta_moderator' });
    expect(overlap.overlap).toBe(3);
    expect(overlap.total).toBe(3);
    expect(overlap.isExact).toBe(false);
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

  it('suppresses zero and near-zero slices from legend output', () => {
    const slices = collapseDistributionSlices(
      [
        { cohortId: 'a', score: 0.7 },
        { cohortId: 'b', score: 0.25 },
        { cohortId: 'c', score: 0.009 },
        { cohortId: 'd', score: 0 }
      ],
      (id) => id ?? 'none',
      4,
      0.01
    );
    expect(slices.some((slice) => slice.label === 'c')).toBe(false);
    expect(slices.some((slice) => slice.score === 0)).toBe(false);
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
    expect(summary.headline).toBe('No clear leading cohort');
  });

  it('marks tentative leader for mid separation', () => {
    const summary = summarizeBehaviorRead(
      [
        { cohortId: 'a', score: 0.47 },
        { cohortId: 'b', score: 0.35 }
      ],
      0.1
    );
    expect(summary.headline).toBe('Tentative leader');
  });

  it('demotes inverse signal unless it is strong and behavior specificity is low', () => {
    expect(shouldPromoteInverseSignal(0.22, 0.05)).toBe(false);
    expect(shouldPromoteInverseSignal(0.42, 0.08)).toBe(true);
    expect(shouldPromoteInverseSignal(0.42, 0.2)).toBe(false);
  });
});

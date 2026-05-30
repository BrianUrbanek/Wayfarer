import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ConfidenceGrowthPanel } from '../ui/components/ConfidenceGrowthPanel';

describe('ConfidenceGrowthPanel', () => {
  it('renders turn-level confidence growth rows', () => {
    const html = renderToString(
      <ConfidenceGrowthPanel
        rows={[
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
      smartGambleCount: 0,
      discoveryProbeCount: 0
          }
        ]}
      />
    );

    expect(html).toContain('Confidence Growth');
    expect(html).toContain('Stored post-turn confidence snapshots');
    expect(html).toContain('Created');
    expect(html).toContain('Cumulative');
    expect(html).toContain('Avg certainty');
    expect(html).toContain('Avg evidence');
    expect(html).toContain('Turn');
    expect(html).toContain('0');
    expect(html).toContain('50%');
  });
});

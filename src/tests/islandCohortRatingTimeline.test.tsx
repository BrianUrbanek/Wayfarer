import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { IslandCohortRatingTimeline } from '../ui/routing/IslandCohortRatingTimeline';

describe('island cohort rating timeline', () => {
  it('renders a single-cohort chart with a clickable cohort key', () => {
    const html = renderToString(
      <IslandCohortRatingTimeline
        rows={[
          { turn: 0, cohortId: 'cohort-action', affinity: 0.1, confidence: 0.5, ratingDeviation: 0.3, uncertainty: 0.2, volatility: 0.1, effectiveWeight: 1, evidenceCount: 2 },
          { turn: 1, cohortId: 'cohort-action', affinity: 0.3, confidence: 0.6, ratingDeviation: 0.25, uncertainty: 0.18, volatility: 0.08, effectiveWeight: 1.1, evidenceCount: 3 },
          { turn: 1, cohortId: 'cohort-story', affinity: -0.2, confidence: 0.4, ratingDeviation: 0.45, uncertainty: 0.35, volatility: 0.05, effectiveWeight: 0.9, evidenceCount: 1 }
        ]}
        cohortLabelById={new Map([
          ['cohort-action', 'Action'],
          ['cohort-story', 'Story']
        ])}
      />
    );

    expect(html).toContain('Island / Cohort Rating Timeline');
    expect(html).toContain('Single-cohort trend view');
    expect(html).toContain('Action');
    expect(html).toContain('Story');
    expect(html).toContain('Selected cohort line');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('Island cohort rating timeline');
  });
});

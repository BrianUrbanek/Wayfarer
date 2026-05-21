import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { IslandConfidenceRadar } from '../ui/routing/IslandConfidenceRadar';
import { RatingEventWeightTable } from '../ui/routing/RatingEventWeightTable';

describe('rating event weight UI prep components', () => {
  it('renders island confidence radar title and helper copy', () => {
    const html = renderToString(
      <IslandConfidenceRadar
        data={[
          { cohortId: 'cohort-action', confidence: 0.2, label: 'Action' },
          { cohortId: 'cohort-story', confidence: 0.8, label: 'Story' }
        ]}
      />
    );

    expect(html).toContain('Island confidence by cohort');
    expect(html).toContain('Confidence indicates certainty');
    expect(html).toContain('Action');
    expect(html).toContain('Story');
  });

  it('renders rating event weight table with expected explanatory copy and columns', () => {
    const html = renderToString(
      <RatingEventWeightTable
        rows={[
          {
            eventId: 'evt-1',
            userId: 'user-1',
            islandId: 'island-1',
            cohortId: 'cohort-action',
            rating: -1,
            trustWeight: 0.5,
            currentContextConfidence: 0.25,
            uncertaintyLeverage: 0.75,
            eventWeight: 0.375,
            directionalContribution: -0.2625
          }
        ]}
      />
    );

    expect(html).toContain('Rating Event Weight');
    expect(html).toContain('Trust comes from the rater');
    expect(html).toContain('Current-context leverage');
    expect(html).toContain('Directional contribution');
    expect(html).toContain('user-1');
    expect(html).toContain('cohort-action');
  });
});

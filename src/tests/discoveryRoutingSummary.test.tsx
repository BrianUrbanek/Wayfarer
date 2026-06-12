import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DiscoveryRoutingSummary } from '../ui/routing/DiscoveryRoutingSummary';

describe('discovery routing summary', () => {
  it('renders positive-fit and deprioritization surfaces', () => {
    const html = renderToString(
      <DiscoveryRoutingSummary
        selectedUserLabel="User A"
        routingModeLabel="Guided"
        routingProfileLabel="Standard"
        explorationWeight={0.55}
        badFitGuardThreshold={-0.35}
        guidedRecommendationsPerUser={3}
        recommendations={[
          {
            userId: 'user-a',
            islandId: 'island-1',
            predictedFit: 0.8,
            affinitySupport: 0.7,
            discoveryValue: 0.1,
            recommendationScore: 0.85,
            recommendationKind: 'SAFE_FIT',
            canonicalRecommendationKind: 'SAFE_FIT',
            canonicalRoutingReason: 'safeFit',
            compatibilityOnlyRoutingKind: false,
            explanation: 'safe recommendation',
            unrated: true,
            topCohorts: []
          }
        ]}
        deprioritizationRows={[
          {
            userId: 'user-a',
            islandId: 'island-2',
            predictedFit: -0.8,
            confidenceSupport: 0.9,
            effectiveWeight: 6,
            topNegativeCohortId: 'cohort-a',
            topNegativeAffinity: -0.8,
            topNegativeConfidence: 0.9,
            deprioritizationScore: 0.52,
            explanation: 'deprioritize for this user'
          }
        ]}
        islandLabelForId={(id) => (id === 'island-1' ? 'Island 1' : 'Island 2')}
        onInspectRecommendation={() => undefined}
      />
    );

    expect(html).toContain('Recommended unrated islands');
    expect(html).toContain('Deprioritized for selected user');
    expect(html).toContain('Guided routing candidates for');
    expect(html).toContain('Bad-fit guard');
    expect(html).toContain('Rejects only likely bounce-offs');
    expect(html).toContain('Negative-fit candidates for');
    expect(html).toContain('Island 1');
    expect(html).toContain('Island 2');
  });
});
